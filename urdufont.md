# Urdu Font Documentation

## Overview
The Well-Being Agent uses optimized Google Fonts for Urdu language support to ensure proper rendering of Urdu script (Nastaliq and Naskh styles) across different browsers and devices.

## Fonts Used

### Primary Urdu Fonts
- **Noto Nastaliq Urdu** - Primary font for Urdu text, supports Nastaliq script
- **Noto Naskh Arabic** - Secondary font for Naskh-style Arabic/Urdu text
- **Scheherazade New** - Traditional Arabic calligraphy style
- **Lateef** - Modern Arabic font with good Urdu support
- **Amiri** - Classical Arabic typography

### Fallback Fonts
- **Segoe UI** - Windows system font with Arabic support
- **Tahoma** - Cross-platform fallback

## CSS Implementation

### Font Loading
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Scheherazade+New:wght@400;500;600;700&family=Lateef:wght@400;500;600;700&family=Amiri:wght@400;500;600;700&family=Poppins:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600&display=swap" rel="stylesheet">
```

### Urdu Text Styling
```css
.urdu-text {
    font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', 'Scheherazade New', 'Lateef', 'Amiri', serif !important;
    line-height: 1.8 !important;
    font-size: 1em !important;
    font-weight: 400 !important;
    direction: rtl !important;
    text-align: right !important;
}
```

### Message Content
```css
.message.urdu-text .message-content p {
    font-family: 'Noto Nastaliq Urdu', 'Scheherazade New', 'Lateef', serif !important;
    font-size: 1em !important;
    line-height: 2.0 !important;
    text-align: right !important;
    direction: rtl !important;
}
```

### Input Fields
```css
#userInput[style*="direction: rtl"] {
    font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', 'Scheherazade New', 'Segoe UI', Tahoma, sans-serif !important;
}
```

### UI Elements
```css
.language-badge {
    font-family: 'Noto Naskh Arabic', 'Segoe UI', Tahoma, sans-serif !important;
}

.tab-btn[data-tab="urdu"] {
    font-family: 'Noto Naskh Arabic', 'Segoe UI', Tahoma, sans-serif !important;
}
```

## Font Features
- **RTL Support**: Right-to-left text direction for proper Urdu rendering
- **OpenType Features**: Kerning, ligatures, and contextual alternates enabled
- **Responsive Sizing**: Optimized line-height and font-size for readability
- **Cross-browser Compatibility**: Multiple fallbacks ensure consistent display

## Performance Considerations
- Fonts are loaded from Google Fonts CDN for optimal caching
- Preconnect headers are used for faster font loading
- Font-display: swap ensures text remains visible during font loading

## Browser Support
- Modern browsers with full Unicode support
- Tested on Chrome, Firefox, Safari, and Edge
- Fallback fonts ensure readability even if web fonts fail to load