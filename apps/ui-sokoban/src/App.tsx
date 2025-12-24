import { useEffect } from 'react'
import { SokobanGame } from './SokobanGame'

function App() {
  // Apply dark mode to document
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  return <SokobanGame />
}

export default App
