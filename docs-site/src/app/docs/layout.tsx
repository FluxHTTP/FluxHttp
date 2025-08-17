'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, FileText, Code, Zap, Settings, Bug, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  href?: string;
  icon?: React.ReactNode;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  {
    title: 'Getting Started',
    icon: <Zap className="h-4 w-4" />,
    children: [
      { title: 'Introduction', href: '/docs' },
      { title: 'Installation', href: '/docs/installation' },
      { title: 'Quick Start', href: '/docs/quick-start' },
      { title: 'Basic Usage', href: '/docs/basic-usage' },
    ],
  },
  {
    title: 'Core Concepts',
    icon: <FileText className="h-4 w-4" />,
    children: [
      { title: 'Configuration', href: '/docs/configuration' },
      { title: 'Adapters', href: '/docs/adapters' },
      { title: 'Interceptors', href: '/docs/interceptors' },
      { title: 'Error Handling', href: '/docs/error-handling' },
    ],
  },
  {
    title: 'Advanced Features',
    icon: <Settings className="h-4 w-4" />,
    children: [
      { title: 'Retry Logic', href: '/docs/retry' },
      { title: 'Caching', href: '/docs/caching' },
      { title: 'Security', href: '/docs/security' },
      { title: 'Request Cancellation', href: '/docs/cancellation' },
      { title: 'Progress Tracking', href: '/docs/progress' },
    ],
  },
  {
    title: 'Framework Integration',
    icon: <Code className="h-4 w-4" />,
    children: [
      { title: 'React', href: '/docs/frameworks/react' },
      { title: 'Vue.js', href: '/docs/frameworks/vue' },
      { title: 'Angular', href: '/docs/frameworks/angular' },
      { title: 'Svelte', href: '/docs/frameworks/svelte' },
      { title: 'Node.js', href: '/docs/frameworks/nodejs' },
    ],
  },
  {
    title: 'API Reference',
    icon: <Code className="h-4 w-4" />,
    children: [
      { title: 'fluxhttp Instance', href: '/docs/api/instance' },
      { title: 'Request Config', href: '/docs/api/config' },
      { title: 'Response', href: '/docs/api/response' },
      { title: 'Error', href: '/docs/api/error' },
      { title: 'Types', href: '/docs/api/types' },
    ],
  },
  {
    title: 'Migration & Guides',
    icon: <ArrowUpRight className="h-4 w-4" />,
    children: [
      { title: 'From Axios', href: '/docs/migration/axios' },
      { title: 'From Fetch', href: '/docs/migration/fetch' },
      { title: 'Performance Tips', href: '/docs/performance' },
      { title: 'Best Practices', href: '/docs/best-practices' },
    ],
  },
  {
    title: 'Troubleshooting',
    icon: <Bug className="h-4 w-4" />,
    children: [
      { title: 'Common Issues', href: '/docs/troubleshooting' },
      { title: 'Debugging', href: '/docs/debugging' },
      { title: 'FAQ', href: '/docs/faq' },
    ],
  },
];

function NavTree({ items, level = 0 }: { items: NavItem[]; level?: number }) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (title: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <ul className={cn('space-y-1', level > 0 && 'ml-4 mt-2')}>
      {items.map((item) => {
        const isActive = item.href === pathname;
        const isExpanded = expandedItems.has(item.title);
        const hasChildren = item.children && item.children.length > 0;

        return (
          <li key={item.title}>
            <div className="flex items-center">
              {item.href ? (
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isActive && 'bg-primary text-primary-foreground'
                  )}
                >
                  {item.icon && <span className="mr-2">{item.icon}</span>}
                  {item.title}
                </Link>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start px-3 py-2 h-auto"
                  onClick={() => toggleExpanded(item.title)}
                >
                  {hasChildren && (
                    <span className="mr-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </span>
                  )}
                  {item.icon && <span className="mr-2">{item.icon}</span>}
                  <span className="text-sm font-medium">{item.title}</span>
                </Button>
              )}
            </div>

            {hasChildren && (isExpanded || level === 0) && (
              <NavTree items={item.children!} level={level + 1} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <div className="sticky top-24 h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin">
              <nav className="space-y-1">
                <NavTree items={navigation} />
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="max-w-4xl">
              {children}
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}