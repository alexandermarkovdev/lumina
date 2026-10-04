# VSI website — static reconstruction of plugin 2.3.6

Every page the `vsi-club-manager` 2.3.6 plugin (content version 17) serves on a fresh install, rendered to plain HTML.
Open `index.html` in a browser; all links, images, CSS and JS work from disk or from any static host.

Built 2026-09-28 from `VSI-Website-Plugin-2.3.6.zip` with the same generator as `vsi-site-2.3.2-html/`.
Compared with the 2.3.2 folder, the only text changes are the trainer corrections from 2.3.3–2.3.6
(roles and card labels for Аделина, Дара, Александра and Михаел, Дара's card description, Спас's НСА line).
The design files under `wp-content/plugins/vsi-club-manager/` are byte-identical to 2.3.2.

## How it was produced

Nothing here was written by hand. The plugin's own PHP ran against a small stand-in for WordPress (`_build/`):

1. `starter.php` → `vsic_import_starter()` imported `seed/content.json` exactly as the setup screen does.
2. Every `admin_init` migration (content versions 2–17) and the facilities upgrade ran.
3. Each route was rendered through `design-loader.php` → `template_include` → the real template files,
   `wp_head` / `wp_footer` and the enqueue system.
4. Image markup, `wpautop`, escaping, pagination, document titles and body classes use functions extracted
   verbatim from WordPress 6.8 core (`_build/wpcore/extracted.php`).
5. The plugin's design assets (CSS, JS, font, facility photos) were copied into `wp-content/plugins/vsi-club-manager/design/`.

## Pages (23)

| URL on the real site | File |
| --- | --- |
| `/` | `index.html` |
| `/za-kompleksa/` `/ceni/` `/trenyori/` `/vaprosi/` `/galeriya/` | `<slug>/index.html` |
| `/trenyori/<coach>/` ×10 | `trenyori/<coach>/index.html` |
| `/novini/` `/novini/page/2/` | `novini/index.html`, `novini/page/2/index.html` |
| `/novini/<article>/` ×4 | `novini/<article>/index.html` |
| 404 page | `404.html` |

## Deliberate differences from a live WordPress page

Same as the 2.3.2 folder: internal links are relative and end in `index.html`; canonical / Open Graph /
JSON-LD keep the absolute `https://vsiswimming.com/...` form; WordPress core boilerplate the plugin does not
control is omitted; post IDs and `?ver=` cache tags differ from a live install; the blank live site name
shows up in the news archive and 404 titles.

## Rebuilding

Requires PHP 8.1+ with GD (WebP) and mbstring. Point `_build/config.json` at an extracted copy of the plugin
(`plugin`) and at this folder (`out`) — the `plugin` path currently points to a temporary folder — then:

```
php _build/build.php import
php _build/build.php routes
php _build/build.php render <route-key>   # once per route
```

Copy `design/` assets from the plugin into `wp-content/plugins/vsi-club-manager/design/` afterwards.
Changes made directly to the HTML here do not reach WordPress; they must be ported into the plugin.
