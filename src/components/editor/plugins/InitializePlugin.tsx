import { useEffect, useRef } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  $isElementNode,
  LexicalNode,
  TextNode
} from 'lexical'
import { NormalizedItem } from '../../../types'
import { PlaceholderNode, $createPlaceholderNode } from '../nodes/PlaceholderNode'
import { normalizedArraysEqual } from '../../../utils/normalizedComparison'

// Plugin to initialize editor with normalized content
interface InitializePluginProps {
  normalizedContent: NormalizedItem[]
}

export function InitializePlugin({ normalizedContent }: InitializePluginProps): null {
  const [editor] = useLexicalComposerContext()
  const isInitializedRef = useRef(false)
  const lastExternalContentRef = useRef<NormalizedItem[]>([])

  // Helper function to get current editor content as normalized items
  const getCurrentContent = (): NormalizedItem[] => {
    const root = $getRoot()
    const paragraphs = root.getChildren()

    if (paragraphs.length === 0) {
      return []
    }

    const items: NormalizedItem[] = []

    paragraphs.forEach((paragraph, paragraphIdx) => {
      if (!$isElementNode(paragraph)) return

      const children = paragraph.getChildren()

      children.forEach((node: LexicalNode) => {
        if (node instanceof TextNode) {
          const text = node.getTextContent()
          if (text) {
            items.push(text)
          }
        } else if (node instanceof PlaceholderNode) {
          items.push(node.__placeholder)
        }
      })

      // Add newline after each paragraph except the last
      if (paragraphIdx < paragraphs.length - 1) {
        // Append newline to the last text item, or create a new text item
        if (items.length > 0 && typeof items[items.length - 1] === 'string') {
          items[items.length - 1] = (items[items.length - 1] as string) + '\n'
        } else {
          items.push('\n')
        }
      }
    })

    return items
  }

  useEffect(() => {
    // Only update if:
    // 1. This is the first initialization, OR
    // 2. The new content is different from what we last set externally AND different from current editor content

    // Read current content first (synchronously, outside of update)
    let currentContent: NormalizedItem[] = []
    editor.getEditorState().read(() => {
      currentContent = getCurrentContent()
    })

    // Check if this is genuinely new external content
    const isNewExternalContent = !normalizedArraysEqual(normalizedContent, lastExternalContentRef.current)
    const isDifferentFromCurrent = !normalizedArraysEqual(normalizedContent, currentContent)

    if (!isInitializedRef.current || (isNewExternalContent && isDifferentFromCurrent)) {
      // Schedule update outside of read() to avoid flushSync warning
      editor.update(() => {
        const root = $getRoot()
        root.clear()

        let paragraph = $createParagraphNode()

        // Track placeholder index (1-based)
        let placeholderIndex = 1

        normalizedContent.forEach((item) => {
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

        lastExternalContentRef.current = [...normalizedContent]
        isInitializedRef.current = true
      }, { tag: 'content-update' })
    }
  }, [editor, normalizedContent])

  return null
}
