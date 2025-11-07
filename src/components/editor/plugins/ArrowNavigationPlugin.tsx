import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  KEY_ARROW_UP_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  COMMAND_PRIORITY_HIGH,
  $setSelection,
  $createRangeSelection,
  $getRoot,
  $isElementNode,
  TextNode
} from 'lexical'

// Plugin to handle arrow key navigation between paragraphs
export function ArrowNavigationPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    // Handle up arrow - move to end of previous paragraph
    const removeUpArrowCommand = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false

        const anchor = selection.anchor
        const anchorNode = anchor.getNode()

        // Get the current paragraph
        let currentParagraph = anchorNode
        if (!$isElementNode(currentParagraph)) {
          const parent = anchorNode.getParent()
          if (!parent) return false
          currentParagraph = parent
        }

        if (!$isElementNode(currentParagraph)) return false

        // Find the previous paragraph
        const root = $getRoot()
        const paragraphs = root.getChildren()
        const currentIndex = paragraphs.indexOf(currentParagraph)

        if (currentIndex > 0) {
          const prevParagraph = paragraphs[currentIndex - 1]
          if ($isElementNode(prevParagraph)) {
            // Find the last text node in the previous paragraph
            const children = prevParagraph.getChildren()
            for (let i = children.length - 1; i >= 0; i--) {
              const child = children[i]
              if (child instanceof TextNode) {
                // Move to end of this text node
                const newSelection = $createRangeSelection()
                newSelection.anchor.set(child.getKey(), child.getTextContent().length, 'text')
                newSelection.focus.set(child.getKey(), child.getTextContent().length, 'text')
                $setSelection(newSelection)
                event?.preventDefault()
                return true
              }
            }
            // If no text node found, move to end of paragraph at element level
            const newSelection = $createRangeSelection()
            newSelection.anchor.set(prevParagraph.getKey(), children.length, 'element')
            newSelection.focus.set(prevParagraph.getKey(), children.length, 'element')
            $setSelection(newSelection)
            event?.preventDefault()
            return true
          }
        }

        return false
      },
      COMMAND_PRIORITY_HIGH
    )

    // Handle down arrow - move to beginning of next paragraph
    const removeDownArrowCommand = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false

        const anchor = selection.anchor
        const anchorNode = anchor.getNode()

        // Get the current paragraph
        let currentParagraph = anchorNode
        if (!$isElementNode(currentParagraph)) {
          const parent = anchorNode.getParent()
          if (!parent) return false
          currentParagraph = parent
        }

        if (!$isElementNode(currentParagraph)) return false

        // Find the next paragraph
        const root = $getRoot()
        const paragraphs = root.getChildren()
        const currentIndex = paragraphs.indexOf(currentParagraph)

        if (currentIndex < paragraphs.length - 1) {
          const nextParagraph = paragraphs[currentIndex + 1]
          if ($isElementNode(nextParagraph)) {
            // Always position at the start (element level position 0)
            // This places cursor before the first child, whether it's text or placeholder
            const newSelection = $createRangeSelection()
            newSelection.anchor.set(nextParagraph.getKey(), 0, 'element')
            newSelection.focus.set(nextParagraph.getKey(), 0, 'element')
            $setSelection(newSelection)
            event?.preventDefault()
            return true
          }
        }

        return false
      },
      COMMAND_PRIORITY_HIGH
    )

    return () => {
      removeUpArrowCommand()
      removeDownArrowCommand()
    }
  }, [editor])

  return null
}
