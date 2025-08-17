'use client';

import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Prism from 'prismjs';

// Import Prism languages
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  fileName?: string;
  highlightLines?: number[];
  className?: string;
}

export function CodeBlock({
  code,
  language = 'typescript',
  showLineNumbers = false,
  fileName,
  highlightLines = [],
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const highlighted = Prism.highlight(
        code,
        Prism.languages[language] || Prism.languages.typescript,
        language
      );
      setHighlightedCode(highlighted);
    }
  }, [code, language]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const lines = code.split('\n');

  return (
    <div className={cn('relative group', className)}>
      {/* Header */}
      {fileName && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted border border-b-0 rounded-t-lg">
          <span className="text-sm font-medium text-muted-foreground">
            {fileName}
          </span>
          <span className="text-xs text-muted-foreground uppercase">
            {language}
          </span>
        </div>
      )}

      {/* Code container */}
      <div className="relative">
        <pre
          className={cn(
            'overflow-x-auto p-4 text-sm',
            'bg-muted border',
            fileName ? 'rounded-b-lg' : 'rounded-lg',
            'scrollbar-thin'
          )}
        >
          <code
            className={cn(
              'block',
              showLineNumbers && 'grid grid-cols-[auto_1fr] gap-4'
            )}
          >
            {showLineNumbers ? (
              <>
                {/* Line numbers */}
                <div className="text-muted-foreground/50 text-right select-none">
                  {lines.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        'leading-6',
                        highlightLines.includes(index + 1) &&
                          'bg-primary/10 -mx-2 px-2'
                      )}
                    >
                      {index + 1}
                    </div>
                  ))}
                </div>
                
                {/* Code content */}
                <div>
                  {lines.map((line, index) => (
                    <div
                      key={index}
                      className={cn(
                        'leading-6',
                        highlightLines.includes(index + 1) &&
                          'bg-primary/10 -mx-2 px-2'
                      )}
                      dangerouslySetInnerHTML={{
                        __html: Prism.highlight(
                          line || ' ',
                          Prism.languages[language] || Prism.languages.typescript,
                          language
                        ),
                      }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div
                dangerouslySetInnerHTML={{
                  __html: highlightedCode,
                }}
              />
            )}
          </code>
        </pre>

        {/* Copy button */}
        <Button
          variant="outline"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={copyToClipboard}
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          <span className="sr-only">Copy code</span>
        </Button>
      </div>
    </div>
  );
}