<?php
/**
 * Genera las imágenes del catálogo de AutoPart Pro con la biblioteca GD.
 *
 * Adaptado del generador usado en el proyecto anterior: mismo enfoque de
 * degradado + silueta geométrica + pie con nombre y referencia, pero con
 * siluetas de repuestos automotrices y la paleta grafito/ámbar del sitio.
 *
 * No descarga nada de internet: todo se dibuja por código.
 *
 * Uso:  php scripts/generar-imagenes.php <carpeta-destino> <productos.json>
 */

$destino  = rtrim($argv[1] ?? __DIR__ . '/../backend/publico/imagenes', '/');
$listado  = $argv[2] ?? __DIR__ . '/productos.json';

@mkdir($destino, 0775, true);

$FUENTE  = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
$NEGRITA = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const W = 900;
const H = 900;

/** Paleta por categoría: [fondo superior, fondo inferior, acento]. */
$PALETA = [
    'frenos'        => [[0x2A, 0x16, 0x16], [0x4A, 0x24, 0x22], [0xE8, 0x6A, 0x5A]],
    'filtros'       => [[0x16, 0x22, 0x2A], [0x22, 0x3C, 0x4A], [0x5A, 0xC0, 0xE8]],
    'motor'         => [[0x2A, 0x24, 0x14], [0x4A, 0x3E, 0x1E], [0xF2, 0xA9, 0x3B]],
    'suspension'    => [[0x1A, 0x1E, 0x2E], [0x2E, 0x36, 0x52], [0x8E, 0xA6, 0xF0]],
    'electrico'     => [[0x24, 0x18, 0x2C], [0x3E, 0x28, 0x4C], [0xC2, 0x8C, 0xF0]],
    'transmision'   => [[0x18, 0x26, 0x20], [0x28, 0x44, 0x36], [0x5A, 0xD1, 0x9E]],
    'refrigeracion' => [[0x14, 0x20, 0x2C], [0x20, 0x38, 0x4C], [0x4A, 0xC8, 0xD8]],
];

/** Fondo con degradado vertical. */
function degradado($im, array $arriba, array $abajo): void {
    for ($y = 0; $y < H; $y++) {
        $t = $y / (H - 1);
        $c = imagecolorallocate(
            $im,
            (int) round($arriba[0] + ($abajo[0] - $arriba[0]) * $t),
            (int) round($arriba[1] + ($abajo[1] - $arriba[1]) * $t),
            (int) round($arriba[2] + ($abajo[2] - $arriba[2]) * $t),
        );
        imageline($im, 0, $y, W, $y, $c);
    }
}

/** Halo radial suave detrás de la pieza. */
function halo($im, array $ac, int $cx, int $cy): void {
    for ($r = 400; $r > 0; $r -= 2) {
        $t = $r / 400;
        $alfa = min(127, 114 + (int) round($t * $t * 13));
        imagefilledellipse($im, $cx, $cy, $r * 2, $r * 2,
            imagecolorallocatealpha($im, $ac[0], $ac[1], $ac[2], $alfa));
    }
}

function rectRedondo($im, $x1, $y1, $x2, $y2, $r, $color): void {
    imagefilledrectangle($im, $x1 + $r, $y1, $x2 - $r, $y2, $color);
    imagefilledrectangle($im, $x1, $y1 + $r, $x2, $y2 - $r, $color);
    foreach ([[$x1 + $r, $y1 + $r], [$x2 - $r, $y1 + $r],
              [$x1 + $r, $y2 - $r], [$x2 - $r, $y2 - $r]] as [$cx, $cy]) {
        imagefilledellipse($im, $cx, $cy, $r * 2, $r * 2, $color);
    }
}

/** Anillo: círculo relleno con un agujero al centro. */
function anillo($im, $cx, $cy, $radioExterno, $radioInterno, $color, $fondo): void {
    imagefilledellipse($im, $cx, $cy, $radioExterno * 2, $radioExterno * 2, $color);
    imagefilledellipse($im, $cx, $cy, $radioInterno * 2, $radioInterno * 2, $fondo);
}

/**
 * Dibuja la silueta correspondiente al tipo de repuesto.
 * El tipo se deduce del prefijo del SKU, que ya codifica la categoría.
 */
function silueta($im, string $tipo, $cuerpo, $acento, $sombra, $oscuro): void {
    $cx = 450;
    $cy = 400;

    switch ($tipo) {
        case 'FRE-DIS': // disco de freno
            imagefilledellipse($im, $cx, $cy, 520, 520, $sombra);
            anillo($im, $cx, $cy, 250, 95, $cuerpo, $acento);
            imagefilledellipse($im, $cx, $cy, 120, 120, $oscuro);
            // Perforaciones de ventilación
            for ($i = 0; $i < 12; $i++) {
                $a = $i * (M_PI / 6);
                imagefilledellipse($im,
                    (int) ($cx + cos($a) * 180), (int) ($cy + sin($a) * 180), 30, 30, $oscuro);
            }
            for ($i = 0; $i < 5; $i++) {
                $a = $i * (2 * M_PI / 5) + 0.3;
                imagefilledellipse($im,
                    (int) ($cx + cos($a) * 72), (int) ($cy + sin($a) * 72), 26, 26, $acento);
            }
            break;

        case 'FRE-PAS': // pastillas de freno
            for ($i = 0; $i < 2; $i++) {
                $x = $cx - 210 + $i * 230;
                rectRedondo($im, $x, $cy - 150, $x + 190, $cy + 150, 20, $sombra);
                rectRedondo($im, $x - 6, $cy - 160, $x + 184, $cy + 140, 18, $cuerpo);
                rectRedondo($im, $x + 4, $cy - 150, $x + 174, $cy - 70, 10, $acento);
            }
            break;

        case 'FRE-BAN': // bandas de freno: dos medias lunas enfrentadas
            // El arco se traza con círculos sucesivos sobre la trayectoria:
            // recortar un arco con un relleno semitransparente dejaría manchas.
            foreach ([[200, 340, $cuerpo], [20, 160, $acento]] as [$desde, $hasta, $color]) {
                for ($g = $desde; $g <= $hasta; $g++) {
                    $a = deg2rad($g);
                    imagefilledellipse($im,
                        (int) ($cx + cos($a) * 230), (int) ($cy + sin($a) * 230), 62, 62, $color);
                }
            }
            // Zapatas de apoyo en los extremos
            foreach ([[200, $cuerpo], [340, $cuerpo], [20, $acento], [160, $acento]] as [$g, $color]) {
                $a = deg2rad($g);
                imagefilledellipse($im,
                    (int) ($cx + cos($a) * 230), (int) ($cy + sin($a) * 230), 86, 86, $color);
            }
            imagefilledellipse($im, $cx, $cy, 90, 90, $oscuro);
            break;

        case 'FRE-LIQ': // envase de líquido
            rectRedondo($im, $cx - 120, $cy - 180, $cx + 120, $cy + 220, 24, $cuerpo);
            rectRedondo($im, $cx - 55, $cy - 250, $cx + 55, $cy - 170, 12, $oscuro);
            rectRedondo($im, $cx - 90, $cy - 60, $cx + 90, $cy + 120, 10, $acento);
            break;

        case 'FIL-ACE': // filtro de aceite: cilindro
            rectRedondo($im, $cx - 150, $cy - 200, $cx + 150, $cy + 200, 40, $sombra);
            rectRedondo($im, $cx - 140, $cy - 210, $cx + 140, $cy + 190, 36, $cuerpo);
            imagefilledrectangle($im, $cx - 140, $cy - 60, $cx + 140, $cy + 40, $acento);
            imagefilledellipse($im, $cx, $cy - 210, 280, 70, $oscuro);
            break;

        case 'FIL-AIR':
        case 'FIL-CAB': // filtro plisado rectangular
            rectRedondo($im, $cx - 280, $cy - 170, $cx + 280, $cy + 170, 18, $sombra);
            rectRedondo($im, $cx - 270, $cy - 180, $cx + 270, $cy + 160, 16, $cuerpo);
            for ($i = 0; $i < 14; $i++) {
                $x = $cx - 252 + $i * 36;
                imagefilledrectangle($im, $x, $cy - 150, $x + 20, $cy + 130, $acento);
            }
            break;

        case 'FIL-COM': // filtro en línea
            rectRedondo($im, $cx - 190, $cy - 90, $cx + 190, $cy + 90, 45, $cuerpo);
            imagefilledrectangle($im, $cx - 260, $cy - 22, $cx - 180, $cy + 22, $oscuro);
            imagefilledrectangle($im, $cx + 180, $cy - 22, $cx + 260, $cy + 22, $oscuro);
            imagefilledrectangle($im, $cx - 120, $cy - 90, $cx + 120, $cy + 90, $acento);
            break;

        case 'MOT-BUJ': // bujías
            for ($i = 0; $i < 4; $i++) {
                $x = $cx - 240 + $i * 160;
                rectRedondo($im, $x, $cy - 230, $x + 80, $cy - 40, 14, $cuerpo);
                imagefilledrectangle($im, $x + 6, $cy - 40, $x + 74, $cy + 60, $acento);
                rectRedondo($im, $x + 20, $cy + 60, $x + 60, $cy + 200, 8, $oscuro);
                imagefilledrectangle($im, $x + 30, $cy + 200, $x + 50, $cy + 240, $acento);
            }
            break;

        case 'MOT-COR': // correa dentada
            anillo($im, $cx, $cy, 250, 215, $oscuro, $sombra);
            for ($i = 0; $i < 36; $i++) {
                $a = $i * (M_PI / 18);
                imagefilledellipse($im,
                    (int) ($cx + cos($a) * 232), (int) ($cy + sin($a) * 232), 26, 26, $acento);
            }
            break;

        case 'MOT-BOM':
        case 'REF-BOM': // bomba
            imagefilledellipse($im, $cx, $cy, 400, 400, $cuerpo);
            imagefilledellipse($im, $cx, $cy, 180, 180, $oscuro);
            for ($i = 0; $i < 8; $i++) {
                $a = $i * (M_PI / 4);
                imagefilledpolygon($im, [
                    $cx, $cy,
                    (int) ($cx + cos($a) * 190), (int) ($cy + sin($a) * 190),
                    (int) ($cx + cos($a + 0.35) * 190), (int) ($cy + sin($a + 0.35) * 190),
                ], $acento);
            }
            imagefilledellipse($im, $cx, $cy, 90, 90, $oscuro);
            break;

        case 'MOT-EMP': // empaque de culata
            rectRedondo($im, $cx - 300, $cy - 180, $cx + 300, $cy + 180, 24, $cuerpo);
            for ($i = 0; $i < 4; $i++) {
                imagefilledellipse($im, $cx - 210 + $i * 140, $cy, 120, 120, $acento);
                imagefilledellipse($im, $cx - 210 + $i * 140, $cy, 96, 96, $sombra);
            }
            break;

        case 'SUS-AMO': // amortiguador
            rectRedondo($im, $cx - 50, $cy - 290, $cx + 50, $cy + 60, 22, $cuerpo);
            rectRedondo($im, $cx - 80, $cy + 40, $cx + 80, $cy + 270, 28, $oscuro);
            imagefilledellipse($im, $cx, $cy - 290, 130, 60, $acento);
            imagefilledellipse($im, $cx, $cy + 270, 150, 70, $acento);
            break;

        case 'SUS-ESP': // espiral
            for ($i = 0; $i < 7; $i++) {
                $y = $cy - 240 + $i * 78;
                imagefilledellipse($im, $cx, $y, 300, 86, $cuerpo);
                imagefilledellipse($im, $cx, $y, 230, 48, $sombra);
            }
            break;

        case 'SUS-ROT': // rótula
            imagefilledellipse($im, $cx, $cy - 60, 230, 230, $cuerpo);
            imagefilledellipse($im, $cx, $cy - 60, 130, 130, $acento);
            imagefilledpolygon($im, [
                $cx - 46, $cy + 20, $cx + 46, $cy + 20,
                $cx + 30, $cy + 240, $cx - 30, $cy + 240,
            ], $cuerpo);
            imagefilledellipse($im, $cx, $cy + 240, 110, 110, $oscuro);
            break;

        case 'SUS-BUJ': // bujes
            foreach ([[-150, 0], [150, 0]] as [$dx, $dy]) {
                anillo($im, $cx + $dx, $cy + $dy, 140, 90, $cuerpo, $acento);
                anillo($im, $cx + $dx, $cy + $dy, 80, 44, $oscuro, $sombra);
            }
            break;

        case 'ELE-BAT': // batería
            rectRedondo($im, $cx - 260, $cy - 160, $cx + 260, $cy + 200, 18, $sombra);
            rectRedondo($im, $cx - 250, $cy - 170, $cx + 250, $cy + 190, 16, $cuerpo);
            rectRedondo($im, $cx - 190, $cy - 230, $cx - 120, $cy - 165, 10, $acento);
            rectRedondo($im, $cx + 120, $cy - 230, $cx + 190, $cy - 165, 10, $oscuro);
            for ($i = 0; $i < 3; $i++) {
                imagefilledrectangle($im, $cx - 200 + $i * 140, $cy - 60, $cx - 80 + $i * 140, $cy + 120, $acento);
            }
            break;

        case 'ELE-ALT':
        case 'ELE-ARR': // alternador / motor de arranque
            rectRedondo($im, $cx - 230, $cy - 130, $cx + 160, $cy + 130, 60, $cuerpo);
            imagefilledellipse($im, $cx + 170, $cy, 230, 230, $cuerpo);
            imagefilledellipse($im, $cx + 170, $cy, 140, 140, $acento);
            imagefilledellipse($im, $cx + 170, $cy, 70, 70, $oscuro);
            for ($i = 0; $i < 7; $i++) {
                imagefilledrectangle($im, $cx - 210 + $i * 48, $cy - 100, $cx - 192 + $i * 48, $cy + 100, $oscuro);
            }
            break;

        case 'ELE-BOM': // bombillos: ampolla clara, casquillo oscuro
            foreach ([-150, 150] as $dx) {
                imagefilledellipse($im, $cx + $dx, $cy - 90, 210, 230, $acento);
                // Filamento insinuado con dos trazos
                imagefilledrectangle($im, $cx + $dx - 34, $cy - 110, $cx + $dx - 22, $cy - 20, $oscuro);
                imagefilledrectangle($im, $cx + $dx + 22, $cy - 110, $cx + $dx + 34, $cy - 20, $oscuro);
                imagefilledrectangle($im, $cx + $dx - 34, $cy - 122, $cx + $dx + 34, $cy - 110, $oscuro);
                // Casquillo metálico roscado
                rectRedondo($im, $cx + $dx - 62, $cy + 10, $cx + $dx + 62, $cy + 170, 10, $cuerpo);
                for ($i = 0; $i < 4; $i++) {
                    imagefilledrectangle($im,
                        $cx + $dx - 62, $cy + 26 + $i * 36, $cx + $dx + 62, $cy + 42 + $i * 36, $oscuro);
                }
                imagefilledrectangle($im, $cx + $dx - 26, $cy + 170, $cx + $dx + 26, $cy + 225, $oscuro);
            }
            break;

        case 'TRA-EMB': // disco de embrague
            imagefilledellipse($im, $cx, $cy, 520, 520, $cuerpo);
            for ($i = 0; $i < 8; $i++) {
                $a = $i * (M_PI / 4);
                imagefilledpolygon($im, [
                    (int) ($cx + cos($a) * 100), (int) ($cy + sin($a) * 100),
                    (int) ($cx + cos($a) * 250), (int) ($cy + sin($a) * 250),
                    (int) ($cx + cos($a + 0.55) * 250), (int) ($cy + sin($a + 0.55) * 250),
                    (int) ($cx + cos($a + 0.55) * 100), (int) ($cy + sin($a + 0.55) * 100),
                ], $acento);
            }
            imagefilledellipse($im, $cx, $cy, 190, 190, $oscuro);
            imagefilledellipse($im, $cx, $cy, 80, 80, $acento);
            break;

        case 'TRA-HOM': // homocinética
            imagefilledellipse($im, $cx - 60, $cy, 300, 300, $cuerpo);
            imagefilledellipse($im, $cx - 60, $cy, 170, 170, $acento);
            imagefilledpolygon($im, [
                $cx + 40, $cy - 60, $cx + 300, $cy - 40,
                $cx + 300, $cy + 40, $cx + 40, $cy + 60,
            ], $cuerpo);
            imagefilledellipse($im, $cx + 300, $cy, 110, 170, $oscuro);
            break;

        case 'REF-RAD': // radiador
            rectRedondo($im, $cx - 300, $cy - 200, $cx + 300, $cy + 200, 16, $sombra);
            rectRedondo($im, $cx - 290, $cy - 210, $cx + 290, $cy + 190, 14, $cuerpo);
            for ($i = 0; $i < 16; $i++) {
                imagefilledrectangle($im, $cx - 270 + $i * 35, $cy - 170, $cx - 250 + $i * 35, $cy + 150, $acento);
            }
            rectRedondo($im, $cx - 300, $cy - 250, $cx + 300, $cy - 200, 12, $oscuro);
            break;

        case 'REF-TER': // termostato
            imagefilledellipse($im, $cx, $cy - 40, 280, 280, $cuerpo);
            imagefilledellipse($im, $cx, $cy - 40, 170, 170, $sombra);
            imagefilledellipse($im, $cx, $cy - 40, 110, 110, $acento);
            imagefilledrectangle($im, $cx - 22, $cy + 90, $cx + 22, $cy + 230, $cuerpo);
            imagefilledellipse($im, $cx, $cy + 230, 90, 90, $oscuro);
            break;

        default: // tuerca genérica
            $puntos = [];
            for ($i = 0; $i < 6; $i++) {
                $a = $i * (M_PI / 3) - M_PI / 6;
                $puntos[] = (int) ($cx + cos($a) * 250);
                $puntos[] = (int) ($cy + sin($a) * 250);
            }
            imagefilledpolygon($im, $puntos, $cuerpo);
            imagefilledellipse($im, $cx, $cy, 230, 230, $acento);
            imagefilledellipse($im, $cx, $cy, 150, 150, $oscuro);
    }
}

/** Texto centrado horizontalmente. */
function centrar($im, string $texto, string $fuente, int $tam, int $y, $color): void {
    $b = imagettfbbox($tam, 0, $fuente, $texto);
    imagettftext($im, $tam, 0, (int) ((W - ($b[2] - $b[0])) / 2), $y, $color, $fuente, $texto);
}

/** Recorta el texto hasta que quepa en el ancho dado. */
function acortar(string $texto, string $fuente, int $tam, int $max): string {
    while (true) {
        $b = imagettfbbox($tam, 0, $fuente, $texto);
        if (($b[2] - $b[0]) <= $max || mb_strlen($texto) < 10) {
            return $texto;
        }
        $texto = mb_substr($texto, 0, mb_strlen($texto) - 2) . '…';
    }
}

$productos = json_decode(file_get_contents($listado), true);
if (!is_array($productos)) {
    fwrite(STDERR, "No se pudo leer el listado de productos: $listado\n");
    exit(1);
}

$generadas = 0;
foreach ($productos as $p) {
    [$arriba, $abajo, $ac] = $PALETA[$p['categoria']] ?? $PALETA['motor'];

    $im = imagecreatetruecolor(W, H);
    imageantialias($im, true);
    degradado($im, $arriba, $abajo);
    halo($im, $ac, 450, 400);

    $cuerpo = imagecolorallocate($im, 0x3A, 0x41, 0x4E);
    $oscuro = imagecolorallocate($im, 0x1C, 0x20, 0x28);
    $sombra = imagecolorallocatealpha($im, 0x00, 0x00, 0x00, 70);
    $acento = imagecolorallocate($im, $ac[0], $ac[1], $ac[2]);
    $claro  = imagecolorallocate($im, 0xF2, 0xF5, 0xF9);
    $tenue  = imagecolorallocatealpha($im, 0xF2, 0xF5, 0xF9, 68);

    // El prefijo del SKU (p. ej. "FRE-DIS") identifica el tipo de pieza.
    $tipo = substr($p['sku'], 0, 7);
    silueta($im, $tipo, $cuerpo, $acento, $sombra, $oscuro);

    centrar($im, acortar($p['nombre'], $NEGRITA, 30, 790), $NEGRITA, 30, 800, $claro);
    centrar($im, 'AUTOPART PRO  ·  ' . $p['sku'], $FUENTE, 19, 845, $tenue);

    imagepng($im, "$destino/{$p['sku']}.png", 8);
    imagedestroy($im);
    $generadas++;
}

echo "Imágenes generadas: $generadas en $destino\n";
