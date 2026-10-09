<?php

namespace TipTapEditor\Media;

use RuntimeException;

/**
 * Downloads one image from a public http(s) URL for "image by URL" (Image/Import).
 *
 * Guards against the server being used to reach internal addresses (SSRF):
 * - only http and https, ports 80 and 443, no user:password in the URL;
 * - every address the host resolves to must be public (no loopback, private, link-local,
 *   carrier-grade NAT, reserved or IPv4-mapped IPv6 ranges), and the connection is pinned to
 *   the checked address so a second DNS answer cannot point elsewhere;
 * - redirects are followed by hand (at most 3), each target checked again;
 * - the body is limited to $maxBytes while it downloads, and the request to a few seconds.
 * The result must be a real JPEG, PNG, GIF, WebP or AVIF by its content (getimagesize); SVG and
 * other types are refused. The caller decides where the file goes (a Media Source).
 */
class RemoteImage
{
    public const TYPES = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG => 'png',
        IMAGETYPE_GIF => 'gif',
        IMAGETYPE_WEBP => 'webp',
    ];

    private const MAX_REDIRECTS = 3;
    private const TIMEOUT = 15;

    /** Error codes (lexicon keys of the tiptapeditor namespace). */
    public const ERR_URL = 'image_import_err_url';
    public const ERR_HOST = 'image_import_err_host';
    public const ERR_DOWNLOAD = 'image_import_err_download';
    public const ERR_SIZE = 'image_import_err_size';
    public const ERR_TYPE = 'image_import_err_type';

    public function __construct(private int $maxBytes)
    {
    }

    /**
     * @return array{content: string, extension: string, name: string} name: the last path
     *         segment of the final URL without its extension (may be empty)
     * @throws RuntimeException with one of the ERR_* codes as message
     */
    public function fetch(string $url): array
    {
        if (!function_exists('curl_init')) {
            throw new RuntimeException(self::ERR_DOWNLOAD);
        }
        $url = trim($url);
        for ($redirects = 0; $redirects <= self::MAX_REDIRECTS; $redirects++) {
            [$host, $port, $address] = $this->check($url);
            $response = $this->request($url, $host, $port, $address);
            if ($response['status'] >= 300 && $response['status'] < 400 && $response['location'] !== '') {
                $url = $this->resolve($url, $response['location']);
                continue;
            }
            if ($response['status'] !== 200) {
                throw new RuntimeException(self::ERR_DOWNLOAD);
            }

            return $this->image($response['body'], $url);
        }
        throw new RuntimeException(self::ERR_DOWNLOAD);
    }

    /**
     * @return array{0: string, 1: int, 2: string} host, port and the checked address to connect to
     */
    protected function check(string $url): array
    {
        if (strlen($url) > 2048 || preg_match('/[\s\x00-\x1f]/', $url)) {
            throw new RuntimeException(self::ERR_URL);
        }
        $parts = parse_url($url);
        $scheme = strtolower((string)($parts['scheme'] ?? ''));
        $host = strtolower(trim((string)($parts['host'] ?? ''), '[]'));
        if (!in_array($scheme, ['http', 'https'], true) || $host === '' || isset($parts['user']) || isset($parts['pass'])) {
            throw new RuntimeException(self::ERR_URL);
        }
        $port = (int)($parts['port'] ?? ($scheme === 'https' ? 443 : 80));
        if (!in_array($port, [80, 443], true)) {
            throw new RuntimeException(self::ERR_HOST);
        }
        $addresses = $this->addresses($host);
        if (!$addresses) {
            throw new RuntimeException(self::ERR_HOST);
        }
        foreach ($addresses as $address) {
            if (!$this->isPublicAddress($address)) {
                throw new RuntimeException(self::ERR_HOST);
            }
        }

        return [$host, $port, $addresses[0]];
    }

    /** @return string[] */
    protected function addresses(string $host): array
    {
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return [$host];
        }
        if (!preg_match('/^[a-z0-9.-]+$/', $host)) {
            return [];
        }
        $addresses = gethostbynamel($host) ?: [];
        $records = @dns_get_record($host, DNS_AAAA) ?: [];
        foreach ($records as $record) {
            if (!empty($record['ipv6'])) {
                $addresses[] = $record['ipv6'];
            }
        }

        return array_values(array_unique($addresses));
    }

    public function isPublicAddress(string $address): bool
    {
        if (!filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return false;
        }
        $packed = inet_pton($address);
        if ($packed === false) {
            return false;
        }
        if (strlen($packed) === 4) {
            $blocked = ['0.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '192.0.0.0/24', '192.0.2.0/24',
                '198.18.0.0/15', '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/3'];
        } else {
            $blocked = ['::/96', '::ffff:0:0/96', '64:ff9b::/96', '100::/64', '2001:db8::/32', '2002::/16', 'fc00::/7',
                'fe80::/10', 'fec0::/10', 'ff00::/8'];
        }
        foreach ($blocked as $range) {
            if ($this->inRange($packed, $range)) {
                return false;
            }
        }

        return true;
    }

    private function inRange(string $packed, string $range): bool
    {
        [$network, $bits] = explode('/', $range);
        $net = inet_pton($network);
        if ($net === false || strlen($net) !== strlen($packed)) {
            return false;
        }
        $bits = (int)$bits;
        $bytes = intdiv($bits, 8);
        if (strncmp($packed, $net, $bytes) !== 0) {
            return false;
        }
        $rest = $bits % 8;
        if ($rest === 0) {
            return true;
        }
        $mask = (0xff << (8 - $rest)) & 0xff;

        return (ord($packed[$bytes]) & $mask) === (ord($net[$bytes]) & $mask);
    }

    /**
     * @return array{status: int, location: string, body: string}
     */
    protected function request(string $url, string $host, int $port, string $address): array
    {
        $body = '';
        $tooLarge = false;
        $location = '';
        $curl = curl_init($url);
        $pinned = str_contains($address, ':') ? '[' . $address . ']' : $address;
        curl_setopt_array($curl, [
            CURLOPT_RESOLVE => [$host . ':' . $port . ':' . $pinned],
            CURLOPT_PROXY => '',
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => self::TIMEOUT,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER => ['Accept: image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9'],
            CURLOPT_USERAGENT => 'TipTapEditor image import (MODX)',
            CURLOPT_HEADERFUNCTION => function ($curl, string $line) use (&$location): int {
                if (stripos($line, 'Location:') === 0) {
                    $location = trim(substr($line, 9));
                }

                return strlen($line);
            },
            CURLOPT_WRITEFUNCTION => function ($curl, string $chunk) use (&$body, &$tooLarge): int {
                if (strlen($body) + strlen($chunk) > $this->maxBytes) {
                    $tooLarge = true;

                    return 0;
                }
                $body .= $chunk;

                return strlen($chunk);
            },
        ]);
        curl_exec($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $failed = curl_errno($curl) !== 0;
        curl_close($curl);
        if ($tooLarge) {
            throw new RuntimeException(self::ERR_SIZE);
        }
        if ($failed && !($status >= 300 && $status < 400)) {
            throw new RuntimeException(self::ERR_DOWNLOAD);
        }

        return ['status' => $status, 'location' => $location, 'body' => $body];
    }

    private function resolve(string $base, string $location): string
    {
        if (preg_match('#^[a-z][a-z0-9+.-]*:#i', $location)) {
            return $location;
        }
        $parts = parse_url($base);
        $origin = $parts['scheme'] . '://' . (str_contains($parts['host'], ':') ? '[' . $parts['host'] . ']' : $parts['host'])
            . (isset($parts['port']) ? ':' . $parts['port'] : '');
        if (str_starts_with($location, '//')) {
            return $parts['scheme'] . ':' . $location;
        }
        if (str_starts_with($location, '/')) {
            return $origin . $location;
        }
        $dir = preg_replace('#/[^/]*$#', '/', $parts['path'] ?? '/');

        return $origin . $dir . $location;
    }

    /**
     * @return array{content: string, extension: string, name: string}
     */
    private function image(string $body, string $url): array
    {
        $info = $body !== '' ? @getimagesizefromstring($body) : false;
        $types = self::TYPES;
        if (defined('IMAGETYPE_AVIF')) {
            $types[IMAGETYPE_AVIF] = 'avif';
        }
        if (!$info || !isset($types[$info[2]])) {
            throw new RuntimeException(self::ERR_TYPE);
        }
        $name = rawurldecode(basename((string)parse_url($url, PHP_URL_PATH)));
        $name = preg_replace('/\.[^.]*$/', '', $name);

        return ['content' => $body, 'extension' => $types[$info[2]], 'name' => (string)$name];
    }

    /**
     * The file name: the filled-in name prefix when set, otherwise the picture's own name made
     * safe ("Фото 1" → "foto-1"); the extension always stays.
     */
    public static function fileName(string $base, string $extension, string $prefix = ''): string
    {
        $named = trim(preg_replace('/\.{2,}/', '.', preg_replace('/[^\p{L}\p{N}_.-]+/u', '-', $prefix) ?? '') ?? '', '.-_');
        if ($named !== '') {
            return $named . '.' . $extension;
        }
        static $cyrillic = [
            'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd', 'е' => 'e', 'ё' => 'e', 'ж' => 'zh', 'з' => 'z',
            'и' => 'i', 'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n', 'о' => 'o', 'п' => 'p', 'р' => 'r',
            'с' => 's', 'т' => 't', 'у' => 'u', 'ф' => 'f', 'х' => 'h', 'ц' => 'ts', 'ч' => 'ch', 'ш' => 'sh',
            'щ' => 'sch', 'ъ' => '', 'ы' => 'y', 'ь' => '', 'э' => 'e', 'ю' => 'yu', 'я' => 'ya', 'і' => 'i',
            'ї' => 'yi', 'є' => 'e', 'ґ' => 'g',
        ];
        $base = strtr(mb_strtolower($base), $cyrillic);
        $base = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($base)) ?? '', '-');
        $base = substr($base, 0, 60) ?: 'image';

        return $base . '.' . $extension;
    }

    /** The name itself when $exists() says it is free, otherwise "name-1.ext", "name-2.ext" … */
    public static function uniqueName(string $name, callable $exists): string
    {
        $dot = strrpos($name, '.');
        [$base, $ext] = $dot ? [substr($name, 0, $dot), substr($name, $dot)] : [$name, ''];
        $candidate = $name;
        for ($i = 1; $i <= 1000 && $exists($candidate); $i++) {
            $candidate = $base . '-' . $i . $ext;
        }

        return $candidate;
    }
}
