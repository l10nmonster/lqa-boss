import React from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical'
import { NormalizedItem } from '../../../types'
import { $createPlaceholderNode } from '../nodes/PlaceholderNode'

export interface NormalizedTextEditorRef {
  blur: () => void
  focus: () => void
  forceUpdate: (content: NormalizedItem[]) => void
}

// Plugin to expose editor methods via ref
export function EditorRefPlugin({ editorRef }: { editorRef: React.RefObject<NormalizedTextEditorRef | null> }): null {
  const [editor] = useLexicalComposerContext()

  React.useImperativeHandle(editorRef, () => ({
    blur: () => {
      editor.blur()
    },
    focus: () => {
      editor.focus()
    },
    forceUpdate: (content: NormalizedItem[]) => {
      editor.update(() => {
        const root = $getRoot()
        root.clear()

        let paragraph = $createParagraphNode()

        // Track placeholder index (1-based)
        let placeholderIndex = 1

        content.forEach((item) => {
          if (typeof item === 'string') {
            // Split by newlines and create separate paragraphs
            const parts = item.split('\n')
            parts.forEach((part, partIdx) => {
              if (partIdx > 0) {
                // Start a new paragraph for each newline
                root.append(paragraph)
                paragraph = $createParagraphNode()
              }
              if (part) {
                paragraph.append($createTextNode(part))
              }
            })
          } else {
            paragraph.append($createPlaceholderNode(item, placeholderIndex))
            placeholderIndex++
          }
        })

        // Append the last paragraph
        root.append(paragraph)
      }, { tag: 'force-update' })
    }
  }), [editor])

  return null
}
