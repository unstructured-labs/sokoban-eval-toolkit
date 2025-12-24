# @sokoban-eval-toolkit/ui-library

Shared UI component library for LMIQ monorepo using ShadCN and Tailwind CSS.

## Overview

This package contains reusable UI components based on ShadCN that can be used across all frontend applications in the monorepo.

## Components

Currently available components:
- **Button** - Versatile button component with multiple variants
- **Card** - Card container with header, content, and footer sections

## Usage in Apps

### 1. Add Dependency

In your app's `package.json`:
```json
{
  "dependencies": {
    "@sokoban-eval-toolkit/ui-library": "workspace:*"
  }
}
```

### 2. Extend Tailwind Config

Create `tailwind.config.ts` in your app:
```ts
import type { Config } from 'tailwindcss'
import baseConfig from '@sokoban-eval-toolkit/ui-library/tailwind.config'

export default {
  ...baseConfig,
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
} satisfies Config
```

### 3. Create PostCSS Config

Create `postcss.config.js`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### 4. Set Up Theme

Create your app's CSS file (e.g., `index.css`) with Tailwind directives and theme variables:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    /* ... more theme variables */
  }
}
```

### 5. Import Components

```tsx
import { Button } from '@sokoban-eval-toolkit/ui-library/components/button'
import { Card, CardHeader, CardTitle, CardContent } from '@sokoban-eval-toolkit/ui-library/components/card'

function MyApp() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hello World</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Click Me</Button>
      </CardContent>
    </Card>
  )
}
```

## Theming

Each app can have its own theme by defining different CSS variable values in its `index.css` file.

### Example: Custom Color Scheme

```css
:root {
  /* Change primary color to green */
  --primary: 142 76% 36%;
  --primary-foreground: 144 61% 98%;

  /* Adjust border radius */
  --radius: 0.75rem;
}
```

### Dark Mode Support

Define dark mode variables:
```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  /* ... other dark mode colors */
}
```

## Adding New Components

To add new ShadCN components to this package:

1. Create the component file in `src/components/`
2. Follow ShadCN's component structure
3. Import from `../lib/utils` for the `cn` helper
4. Export from the component file

Example:
```tsx
// src/components/badge.tsx
import * as React from 'react'
import { cn } from '../lib/utils'

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('badge-styles', className)} {...props} />
  )
)
Badge.displayName = 'Badge'

export { Badge }
```

## Benefits of This Approach

✅ **Shared Components**: Write once, use everywhere
✅ **Custom Themes**: Each app can have unique colors and styling
✅ **Type Safety**: Full TypeScript support
✅ **Easy Updates**: Update a component once, all apps get it
✅ **Flexible**: Apps can override styles when needed

## Available Utilities

### `cn` Helper

Merge Tailwind classes intelligently:
```tsx
import { cn } from '@sokoban-eval-toolkit/ui-library/lib/utils'

<div className={cn('base-class', condition && 'conditional-class', className)} />
```

## Development

```bash
# Type check
bun tsc

# From any app, changes to ui package hot reload automatically
bun dev
```
