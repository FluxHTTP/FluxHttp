import Link from 'next/link';
import { Github, Twitter, Heart } from 'lucide-react';

const footerLinks = {
  product: {
    title: 'Product',
    links: [
      { name: 'Documentation', href: '/docs' },
      { name: 'API Reference', href: '/docs/api' },
      { name: 'Examples', href: '/examples' },
      { name: 'Playground', href: '/playground' },
    ],
  },
  resources: {
    title: 'Resources',
    links: [
      { name: 'Getting Started', href: '/docs/getting-started' },
      { name: 'Migration Guide', href: '/docs/migration' },
      { name: 'Performance', href: '/docs/performance' },
      { name: 'Troubleshooting', href: '/docs/troubleshooting' },
    ],
  },
  community: {
    title: 'Community',
    links: [
      { name: 'GitHub', href: 'https://github.com/fluxhttp/core' },
      { name: 'Issues', href: 'https://github.com/fluxhttp/core/issues' },
      { name: 'Discussions', href: 'https://github.com/fluxhttp/core/discussions' },
      { name: 'Contributing', href: 'https://github.com/fluxhttp/core/blob/main/CONTRIBUTING.md' },
    ],
  },
  legal: {
    title: 'Legal',
    links: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
      { name: 'License', href: 'https://github.com/fluxhttp/core/blob/main/LICENSE' },
    ],
  },
};

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="font-bold text-xl">FluxHTTP</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              A modern, zero-dependency HTTP client for JavaScript and TypeScript applications.
            </p>
            <div className="flex space-x-2">
              <a
                href="https://github.com/fluxhttp/core"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-5 w-5" />
                <span className="sr-only">GitHub</span>
              </a>
              <a
                href="https://twitter.com/fluxhttp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Twitter className="h-5 w-5" />
                <span className="sr-only">Twitter</span>
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([key, section]) => (
            <div key={key}>
              <h3 className="font-semibold mb-4">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.name}>
                    {link.href.startsWith('http') ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.name}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">
            © 2024 FluxHTTP Team. All rights reserved.
          </p>
          <div className="flex items-center text-sm text-muted-foreground mt-4 md:mt-0">
            Made with <Heart className="h-4 w-4 mx-1 text-red-500" /> by the FluxHTTP Team
          </div>
        </div>
      </div>
    </footer>
  );
}