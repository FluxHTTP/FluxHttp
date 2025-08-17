'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Code, Zap, Shield, Globe, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/code-block';
import { FeatureCard } from '@/components/feature-card';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { InteractiveDemo } from '@/components/interactive-demo';
import Link from 'next/link';

const quickStartCode = `// Install FluxHTTP
npm install @fluxhttp/core

// Basic usage
import fluxhttp from '@fluxhttp/core';

// Simple GET request
const response = await fluxhttp.get('https://api.example.com/data');
console.log(response.data);

// POST with data
const result = await fluxhttp.post('/api/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// Create custom instance
const api = fluxhttp.create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Authorization': 'Bearer your-token'
  }
});`;

const features = [
  {
    icon: <Zap className="h-6 w-6" />,
    title: 'Zero Dependencies',
    description: 'No external dependencies. Pure JavaScript with built-in adapters for all environments.',
  },
  {
    icon: <Code className="h-6 w-6" />,
    title: 'TypeScript First',
    description: 'Built with TypeScript from the ground up. Full type safety and excellent IntelliSense.',
  },
  {
    icon: <Globe className="h-6 w-6" />,
    title: 'Universal Compatibility',
    description: 'Works in browsers, Node.js, and edge runtimes. Automatic adapter selection.',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'Built-in Security',
    description: 'CSRF protection, rate limiting, content validation, and security headers out of the box.',
  },
];

const stats = [
  { label: 'Bundle Size', value: '<16KB', description: 'Gzipped' },
  { label: 'Dependencies', value: '0', description: 'Zero deps' },
  { label: 'TypeScript', value: '100%', description: 'Coverage' },
  { label: 'Platforms', value: '3+', description: 'Browser, Node, Edge' },
];

export default function HomePage() {
  const [copiedQuickStart, setCopiedQuickStart] = useState(false);

  const copyQuickStart = async () => {
    await navigator.clipboard.writeText('npm install @fluxhttp/core');
    setCopiedQuickStart(true);
    setTimeout(() => setCopiedQuickStart(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-bg opacity-10"></div>
        <div className="relative container mx-auto px-4 py-20 lg:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl lg:text-6xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mb-6"
            >
              Modern HTTP Client
              <br />
              Zero Dependencies
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              FluxHTTP is a lightweight, TypeScript-first HTTP client with zero dependencies. 
              Built for modern applications with security, performance, and developer experience in mind.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
            >
              <Link href="/docs/getting-started">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              
              <Button
                variant="outline"
                size="lg"
                onClick={copyQuickStart}
                className="w-full sm:w-auto font-mono"
              >
                {copiedQuickStart ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    npm install @fluxhttp/core
                  </>
                )}
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-3xl mx-auto"
            >
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl font-bold text-primary mb-1">{stat.value}</div>
                  <div className="text-sm font-medium">{stat.label}</div>
                  <div className="text-xs text-muted-foreground">{stat.description}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Interactive Demo */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold mb-4">Try FluxHTTP Now</h2>
              <p className="text-muted-foreground">
                Test FluxHTTP directly in your browser with real API calls
              </p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <InteractiveDemo />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold mb-4">Why Choose FluxHTTP?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Built from the ground up for modern JavaScript applications with performance, 
              security, and developer experience as core principles.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <FeatureCard {...feature} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold mb-4">Quick Start</h2>
              <p className="text-muted-foreground">
                Get up and running with FluxHTTP in minutes
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <CodeBlock
                code={quickStartCode}
                language="typescript"
                showLineNumbers
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="text-center mt-8"
            >
              <Link href="/docs/getting-started">
                <Button size="lg">
                  Read Full Documentation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center bg-gradient-to-r from-primary/10 to-purple-600/10 rounded-2xl p-12"
          >
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-muted-foreground mb-8">
              Join thousands of developers who have already switched to FluxHTTP 
              for their HTTP client needs.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/docs/getting-started">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              
              <Link href="/docs/api">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  API Reference
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}