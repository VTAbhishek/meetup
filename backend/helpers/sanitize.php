<?php
/**
 * Allowlist-based HTML sanitizer for the rich "About us" content.
 * Keeps basic formatting (headings, lists, bold/italic/underline, font/colour/
 * size/alignment via <font> or a filtered style attribute) and strips anything
 * executable (scripts, event handlers, javascript: URLs, iframes, …).
 */

const SAN_ALLOWED_TAGS = [
    'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote',
    'span', 'div', 'a', 'font',
];

// Tags whose whole subtree is dangerous — removed entirely, children included.
const SAN_DROP_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta'];

const SAN_ALLOWED_STYLES = [
    'color', 'background-color', 'font-size', 'font-family',
    'text-align', 'text-decoration', 'font-weight', 'font-style',
];

function sanitize_html(string $html): string
{
    $html = trim($html);
    if ($html === '') return '';

    $doc = new DOMDocument();
    libxml_use_internal_errors(true);
    // Wrap so we can reliably extract the fragment afterwards.
    $doc->loadHTML(
        '<?xml encoding="utf-8"?><div id="__san_root__">' . $html . '</div>',
        LIBXML_NOERROR | LIBXML_NOWARNING
    );
    libxml_clear_errors();

    $root = $doc->getElementById('__san_root__');
    if (!$root) return '';

    sanitize_node_children($root);

    $out = '';
    foreach ($root->childNodes as $child) {
        $out .= $doc->saveHTML($child);
    }
    return trim($out);
}

function sanitize_node_children(DOMNode $node): void
{
    // Iterate over a static copy — we mutate the live list as we go.
    $children = [];
    foreach ($node->childNodes as $c) $children[] = $c;

    foreach ($children as $child) {
        if ($child instanceof DOMElement) {
            $tag = strtolower($child->tagName);

            if (in_array($tag, SAN_DROP_TAGS, true)) {
                $node->removeChild($child);
                continue;
            }

            if (!in_array($tag, SAN_ALLOWED_TAGS, true)) {
                // Unwrap: keep the children, drop the element itself.
                while ($child->firstChild) {
                    $node->insertBefore($child->firstChild, $child);
                }
                $node->removeChild($child);
                // The promoted children still need sanitising — handled because
                // we re-scan them via recursion on $node? No: recurse now.
                sanitize_node_children($node);
                return; // list changed shape; restart of this level already done
            }

            sanitize_attributes($child, $tag);
            sanitize_node_children($child);
        } elseif (!($child instanceof DOMText)) {
            // Comments, CDATA, processing instructions — drop.
            $node->removeChild($child);
        }
    }
}

function sanitize_attributes(DOMElement $el, string $tag): void
{
    $keep = [];
    if ($tag === 'a')    $keep = ['href'];
    if ($tag === 'font') $keep = ['color', 'face', 'size'];

    $attrs = [];
    foreach ($el->attributes as $a) $attrs[] = $a->name;

    foreach ($attrs as $name) {
        $lname = strtolower($name);
        if ($lname === 'style') {
            $el->setAttribute('style', sanitize_style($el->getAttribute('style')));
            if ($el->getAttribute('style') === '') $el->removeAttribute('style');
            continue;
        }
        if (!in_array($lname, $keep, true)) {
            $el->removeAttribute($name);
        }
    }

    if ($tag === 'a' && $el->hasAttribute('href')) {
        $href = trim($el->getAttribute('href'));
        if (!preg_match('#^(https?:)?//#i', $href) && !preg_match('#^(mailto|tel):#i', $href)) {
            $el->removeAttribute('href');
        } else {
            $el->setAttribute('target', '_blank');
            $el->setAttribute('rel', 'noopener nofollow');
        }
    }
}

function sanitize_style(string $style): string
{
    $out = [];
    foreach (explode(';', $style) as $decl) {
        $parts = explode(':', $decl, 2);
        if (count($parts) !== 2) continue;
        $prop = strtolower(trim($parts[0]));
        $val  = trim($parts[1]);
        if (!in_array($prop, SAN_ALLOWED_STYLES, true)) continue;
        // Block url(...), expressions and anything else exotic.
        if (preg_match('/url\s*\(|expression|javascript/i', $val)) continue;
        if (!preg_match('/^[#a-z0-9 ,.\'"%()-]+$/i', $val)) continue;
        $out[] = $prop . ': ' . $val;
    }
    return implode('; ', $out);
}
