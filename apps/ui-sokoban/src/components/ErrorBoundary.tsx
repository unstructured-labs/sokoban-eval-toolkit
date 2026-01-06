import { Button } from '@sokoban-eval-toolkit/ui-library/components/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@sokoban-eval-toolkit/ui-library/components/card'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallbackTitle?: string
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="h-full flex flex-col min-h-0 w-80 border-red-500/30">
          <CardHeader className="flex-shrink-0 pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              {this.props.fallbackTitle ?? 'Something went wrong'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-4 min-h-0">
            <div className="bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              <p className="text-red-400 text-xs font-medium mb-1">Error Details:</p>
              <p className="text-red-300 text-xs font-mono break-words">
                {this.state.error?.message ?? 'Unknown error'}
              </p>
            </div>

            {this.state.errorInfo && (
              <details className="text-xs">
                <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                  Stack Trace
                </summary>
                <pre className="bg-muted/20 rounded-md p-2 mt-1 text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <Button onClick={this.handleReset} variant="outline" className="w-full" size="sm">
              <RefreshCw className="w-3 h-3 mr-1.5" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

/**
 * A simpler inline error boundary for smaller components.
 */
interface InlineErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface InlineErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class InlineErrorBoundary extends Component<
  InlineErrorBoundaryProps,
  InlineErrorBoundaryState
> {
  constructor(props: InlineErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): Partial<InlineErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('InlineErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-400 text-xs">Something went wrong</p>
            <p className="text-red-300 text-[10px] font-mono mt-0.5">
              {this.state.error?.message ?? 'Unknown error'}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="text-xs text-red-400 hover:text-red-300 underline mt-1"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
