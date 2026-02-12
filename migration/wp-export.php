<?php
/**
 * WordPress Export Script voor Facturatie Migratie
 * 
 * Gebruik: plak dit in functions.php of gebruik een plugin zoals "Code Snippets"
 * Ga dan naar een pagina met de shortcode [facturatie_export]
 * De pagina toont een JSON export van alle data + download link
 */

add_shortcode('facturatie_export', 'facturatie_export_all_data');

function facturatie_export_all_data() {
    // Alleen voor admins
    if (!current_user_can('administrator')) {
        return '<p>Geen toegang.</p>';
    }

    $data = [
        'exported_at' => date('Y-m-d H:i:s'),
        'klanten'     => facturatie_export_klanten(),
        'inkomsten'   => facturatie_export_inkomsten(),
        'uitgaven'    => facturatie_export_uitgaven(),
    ];

    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
    // Sla op als bestand
    $upload_dir = wp_upload_dir();
    $file_path = $upload_dir['basedir'] . '/facturatie-export.json';
    file_put_contents($file_path, $json);
    $file_url = $upload_dir['baseurl'] . '/facturatie-export.json';

    $counts = sprintf(
        'Klanten: %d | Inkomsten: %d | Uitgaven: %d',
        count($data['klanten']),
        count($data['inkomsten']),
        count($data['uitgaven'])
    );

    $output = '<div style="padding:20px;font-family:monospace;">';
    $output .= '<h2>Facturatie Export</h2>';
    $output .= '<p><strong>' . $counts . '</strong></p>';
    $output .= '<p><a href="' . esc_url($file_url) . '" download class="button button-primary" style="padding:10px 20px;background:#0073aa;color:#fff;text-decoration:none;border-radius:4px;">Download JSON</a></p>';
    $output .= '<details><summary style="cursor:pointer;margin-top:20px;">Bekijk JSON</summary>';
    $output .= '<pre style="max-height:600px;overflow:auto;background:#f1f1f1;padding:15px;font-size:12px;">' . esc_html($json) . '</pre>';
    $output .= '</details></div>';

    return $output;
}

/**
 * Export klanten (WordPress users met rol 'subscriber' of custom rol)
 */
function facturatie_export_klanten() {
    $klanten = [];
    
    // Haal alle subscribers op (klanten zijn meestal subscribers)
    $users = get_users([
        'role__in' => ['subscriber', 'customer', 'klant'],
        'number'   => -1,
    ]);

    // Als dat weinig oplevert, pak alle users behalve admins
    if (count($users) < 2) {
        $users = get_users([
            'role__not_in' => ['administrator'],
            'number'       => -1,
        ]);
    }

    foreach ($users as $user) {
        // ACF velden ophalen
        $factuurnaam     = get_field('factuurnaam', 'user_' . $user->ID) ?: '';
        $telefoonnummer  = get_field('telefoonnummer', 'user_' . $user->ID) ?: '';
        $straat_nummer   = get_field('straat_+_nummer', 'user_' . $user->ID) ?: '';
        $postcode        = get_field('postcode', 'user_' . $user->ID) ?: '';
        $stad            = get_field('stad', 'user_' . $user->ID) ?: '';
        $overig          = get_field('overig', 'user_' . $user->ID) ?: '';

        $klanten[] = [
            'wp_user_id'    => $user->ID,
            'email'         => $user->user_email,
            'voornaam'      => $user->first_name,
            'achternaam'    => $user->last_name,
            'display_name'  => $user->display_name,
            'factuurnaam'   => $factuurnaam,
            'telefoonnummer'=> $telefoonnummer,
            'straat_nummer' => $straat_nummer,
            'postcode'      => $postcode,
            'stad'          => $stad,
            'overig'        => $overig,
        ];
    }

    return $klanten;
}

/**
 * Export inkomsten (custom post type)
 */
function facturatie_export_inkomsten() {
    $inkomsten = [];

    $posts = get_posts([
        'post_type'      => 'inkomsten',
        'posts_per_page' => -1,
        'post_status'    => 'any',
    ]);

    foreach ($posts as $post) {
        // Basis ACF velden
        $factuurnummer   = get_field('factuurnummer', $post->ID) ?: '';
        $factuurdatum    = get_field('factuurdatum', $post->ID) ?: '';
        $factuurdatum_unix = get_field('factuurdatum_unix', $post->ID) ?: '';
        $kwartaal        = get_field('factuur_kwartaal', $post->ID) ?: '';
        $jaar            = get_field('factuur_jaar', $post->ID) ?: '';
        $onderwerp       = get_field('onderwerp', $post->ID) ?: '';
        $daan_of_wim     = get_field('daan_of_wim', $post->ID) ?: '';
        $factuur_status  = get_field('factuur_status', $post->ID) ?: '';

        // Klant gegevens
        $user_select     = get_field('user_select', $post->ID);
        $wp_klant_id     = null;
        if ($user_select) {
            // ACF user field kan een object of ID zijn
            $wp_klant_id = is_object($user_select) ? $user_select->ID : $user_select;
        }
        $factuurnaam     = get_field('factuurnaam', $post->ID) ?: '';
        $tavnaam         = get_field('tavnaam', $post->ID) ?: '';
        $straat_nummer   = get_field('straat_+_nummer', $post->ID) ?: '';
        $postcode_stad   = get_field('postcode_+_stad', $post->ID) ?: '';
        $overige_info    = get_field('overige_info', $post->ID) ?: '';

        // Diensten (regels)
        $regels = [];
        for ($i = 1; $i <= 4; $i++) {
            $dienst   = get_field("dienst_{$i}", $post->ID) ?: '';
            $aantal   = get_field("dienst_aantal_{$i}", $post->ID) ?: 0;
            $waarde   = get_field("dienst_waarde_{$i}", $post->ID) ?: 0;
            
            // Alleen toevoegen als er een beschrijving of waarde is
            if (!empty($dienst) || $waarde > 0) {
                $regels[] = [
                    'beschrijving' => $dienst,
                    'aantal'       => floatval($aantal) ?: 1,
                    'tarief'       => floatval($waarde),
                ];
            }
        }

        // Bedragen
        $factuurpercentage = get_field('factuurpercentage', $post->ID) ?: 0;
        $subtotaal         = get_field('subtotaal', $post->ID) ?: 0;
        $btw_berekenen     = get_field('btw_berekenen', $post->ID) ?: false;
        $btw_waarde        = get_field('btw_waarde', $post->ID) ?: 0;
        $factuur_waarde    = get_field('factuur_waarde', $post->ID) ?: 0;

        // Mollie / contact gegevens
        $voornaam    = get_field('voornaam', $post->ID) ?: '';
        $achternaam  = get_field('achternaam', $post->ID) ?: '';
        $emailadres  = get_field('emailadres', $post->ID) ?: '';

        $inkomsten[] = [
            'wp_post_id'        => $post->ID,
            'post_title'        => $post->post_title,
            'post_date'         => $post->post_date,
            'factuurnummer'     => $factuurnummer,
            'factuurdatum'      => $factuurdatum,
            'factuurdatum_unix' => $factuurdatum_unix,
            'kwartaal'          => $kwartaal,
            'jaar'              => $jaar,
            'onderwerp'         => $onderwerp,
            'daan_of_wim'       => $daan_of_wim,
            'factuur_status'    => $factuur_status,
            'wp_klant_id'       => $wp_klant_id,
            'factuurnaam'       => $factuurnaam,
            'tavnaam'           => $tavnaam,
            'straat_nummer'     => $straat_nummer,
            'postcode_stad'     => $postcode_stad,
            'overige_info'      => $overige_info,
            'regels'            => $regels,
            'factuurpercentage' => floatval($factuurpercentage),
            'subtotaal'         => floatval($subtotaal),
            'btw_berekenen'     => (bool) $btw_berekenen,
            'btw_waarde'        => floatval($btw_waarde),
            'factuur_waarde'    => floatval($factuur_waarde),
            'voornaam'          => $voornaam,
            'achternaam'        => $achternaam,
            'emailadres'        => $emailadres,
        ];
    }

    return $inkomsten;
}

/**
 * Export uitgaven (custom post type)
 */
function facturatie_export_uitgaven() {
    $uitgaven = [];

    $posts = get_posts([
        'post_type'      => 'uitgaven',
        'posts_per_page' => -1,
        'post_status'    => 'any',
    ]);

    foreach ($posts as $post) {
        $factuurnummer = get_field('factuurnummer', $post->ID) ?: '';
        $factuurdatum  = get_field('factuurdatum', $post->ID) ?: '';
        $factuurdatum_unix = get_field('factuurdatum_unix', $post->ID) ?: '';
        $kwartaal      = get_field('factuur_kwartaal', $post->ID) ?: '';
        $jaar          = get_field('factuur_jaar', $post->ID) ?: '';

        // Crediteur (taxonomy) - kan een term ID, term object, of array zijn
        $crediteur = '';
        $crediteur_field = get_field('crediteur', $post->ID);
        if ($crediteur_field) {
            if (is_object($crediteur_field) && isset($crediteur_field->name)) {
                $crediteur = $crediteur_field->name;
            } elseif (is_array($crediteur_field)) {
                $names = [];
                foreach ($crediteur_field as $term) {
                    if (is_object($term) && isset($term->name)) {
                        $names[] = $term->name;
                    } elseif (is_numeric($term)) {
                        $t = get_term($term);
                        $names[] = ($t && !is_wp_error($t)) ? $t->name : strval($term);
                    } else {
                        $names[] = strval($term);
                    }
                }
                $crediteur = implode(', ', $names);
            } elseif (is_numeric($crediteur_field)) {
                // Term ID - ophalen via get_term()
                $term = get_term(intval($crediteur_field));
                $crediteur = ($term && !is_wp_error($term)) ? $term->name : strval($crediteur_field);
            } else {
                $crediteur = strval($crediteur_field);
            }
        }

        $waarde_ex     = get_field('waarde_ex', $post->ID) ?: 0;
        $btw_waarde    = get_field('uit_btw_waarde', $post->ID) ?: 0;
        $totaal_waarde = get_field('uit_totaal_waarde', $post->ID) ?: 0;
        $daan_of_wim   = get_field('daan_of_wim', $post->ID) ?: '';

        // Factuur bijlage - kan een attachment ID, array, of URL zijn
        $bijlage_url = '';
        $bijlage = get_field('factuur_bijlage', $post->ID);
        if ($bijlage) {
            if (is_array($bijlage) && isset($bijlage['url'])) {
                $bijlage_url = $bijlage['url'];
            } elseif (is_numeric($bijlage)) {
                // Attachment ID - ophalen via wp_get_attachment_url()
                $url = wp_get_attachment_url(intval($bijlage));
                $bijlage_url = $url ?: '';
            } elseif (is_string($bijlage) && filter_var($bijlage, FILTER_VALIDATE_URL)) {
                $bijlage_url = $bijlage;
            }
        }

        $uitgaven[] = [
            'wp_post_id'     => $post->ID,
            'post_title'     => $post->post_title,
            'post_date'      => $post->post_date,
            'factuurnummer'  => $factuurnummer,
            'factuurdatum'   => $factuurdatum,
            'factuurdatum_unix' => $factuurdatum_unix,
            'kwartaal'       => $kwartaal,
            'jaar'           => $jaar,
            'crediteur'      => $crediteur,
            'waarde_ex'      => floatval($waarde_ex),
            'btw_waarde'     => floatval($btw_waarde),
            'totaal_waarde'  => floatval($totaal_waarde),
            'daan_of_wim'    => $daan_of_wim,
            'bijlage_url'    => $bijlage_url,
        ];
    }

    return $uitgaven;
}
