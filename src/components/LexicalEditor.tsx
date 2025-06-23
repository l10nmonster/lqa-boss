import React, { useEffect } from 'react'
import { Box } from '@chakra-ui/react'
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical'
import type { InitialConfigType } from '@lexical/react/LexicalComposer'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'

interface LexicalEditorProps {
  initialText: string
  onChange: (text: string) => void
  onFocus: () => void
  isActive: boolean
}

// Component to handle initial text setup
function InitialTextPlugin({ initialText }: { initialText: string }) {
  const [editor] = useLexicalComposerContext()
  
  useEffect(() => {
    editor.update(() => {
      const root = $getRoot()
      root.clear()
      
      if (initialText) {
        const paragraph = $createParagraphNode()
        const textNode = $createTextNode(initialText)
        paragraph.append(textNode)
        root.append(paragraph)
      }
    })
  }, [editor, initialText])
  
  return null
}

const LexicalEditor: React.FC<LexicalEditorProps> = ({
  initialText,
  onChange,
  onFocus,
  isActive,
}) => {
  const editorConfig: InitialConfigType = {
    namespace: 'LQABossEditor',
    theme: {
      paragraph: 'lexical-paragraph',
    },
    onError(error) {
      console.error('Lexical error:', error)
    },
  }

  return (
    <LexicalComposer initialConfig={editorConfig}>
      <Box position="relative">
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              style={{
                minHeight: '60px',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                lineHeight: '1.5',
                outline: 'none',
                transition: 'all 0.2s',
                ...(isActive && {
                  borderColor: 'rgba(66, 153, 225, 0.6)',
                  boxShadow: '0 0 0 2px rgba(66, 153, 225, 0.3)',
                }),
              }}
              onFocus={onFocus}
            />
          }
          placeholder={
            <Box
              position="absolute"
              top="12px"
              left="12px"
              color="whiteAlpha.500"
              pointerEvents="none"
            >
              Enter text...
            </Box>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <OnChangePlugin onChange={(editorState) => {
          editorState.read(() => {
            const root = $getRoot()
            const text = root.getTextContent()
            onChange(text)
          })
        }} />
        <HistoryPlugin />
        <InitialTextPlugin initialText={initialText} />
      </Box>
    </LexicalComposer>
  )
}

export default LexicalEditor 