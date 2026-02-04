import React from 'react';
import { View, Text, ScrollView } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <ScrollView style={{ flex: 1, padding: 24, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{this.state.error.message}</Text>
          {this.state.error.stack ? (
            <Text style={{ fontFamily: 'monospace', fontSize: 10, marginTop: 16 }}>{this.state.error.stack}</Text>
          ) : null}
        </ScrollView>
      );
    }
    return this.props.children;
  }
}
