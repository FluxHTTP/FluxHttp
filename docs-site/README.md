# FluxHTTP Documentation Site

This is the interactive documentation website for FluxHTTP, a modern zero-dependency HTTP client for JavaScript and TypeScript.

## Features

- 📚 **Comprehensive Documentation** - Complete guides and API reference
- 🎮 **Interactive Playground** - Test FluxHTTP directly in the browser
- 🎨 **Modern Design** - Beautiful, responsive interface with dark/light mode
- 🔍 **Search Functionality** - Quickly find what you're looking for
- 📱 **Mobile Friendly** - Optimized for all device sizes
- ⚡ **Fast Performance** - Built with Next.js for optimal speed
- ♿ **Accessible** - WCAG 2.1 compliant

## Getting Started

### Prerequisites

- Node.js 18.0.0 or later
- npm, yarn, pnpm, or bun

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
docs-site/
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── docs/           # Documentation pages
│   │   ├── playground/     # Interactive playground
│   │   └── page.tsx        # Homepage
│   ├── components/         # Reusable components
│   │   ├── ui/            # Base UI components
│   │   ├── code-block.tsx # Syntax highlighted code
│   │   ├── header.tsx     # Site header
│   │   └── footer.tsx     # Site footer
│   ├── lib/               # Utilities and helpers
│   └── styles/            # Global styles
├── public/                # Static assets
└── package.json
```

## Development

### Adding New Documentation Pages

1. Create a new page in `src/app/docs/[page-name]/page.tsx`
2. Add the route to the navigation in `src/app/docs/layout.tsx`
3. Follow the existing patterns for consistent styling

### Adding Code Examples

Use the `CodeBlock` component for syntax highlighting:

```tsx
import { CodeBlock } from '@/components/code-block';

<CodeBlock
  code={exampleCode}
  language="typescript"
  showLineNumbers
  fileName="example.ts"
/>
```

### Styling Guidelines

- Use Tailwind CSS classes for styling
- Follow the design system defined in `globals.css`
- Use semantic HTML elements
- Ensure proper contrast ratios for accessibility

## Deployment

### GitHub Pages

The site is configured for GitHub Pages deployment:

```bash
# Build and export static files
npm run build
npm run export

# Deploy to GitHub Pages (automated via GitHub Actions)
```

### Netlify

The site can also be deployed to Netlify:

1. Connect your GitHub repository
2. Set build command: `npm run build`
3. Set publish directory: `out`

### Vercel

Deploy to Vercel with zero configuration:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure all linting and type checks pass
5. Submit a pull request

### Code Quality

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Run type checking
npm run type-check

# Format code
npm run format
```

## Browser Support

- Chrome 63+
- Firefox 58+
- Safari 12+
- Edge 79+

## License

MIT License - see the [LICENSE](../LICENSE) file for details.