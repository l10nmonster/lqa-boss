import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { PASTE_COMMAND, COMMAND_PRIORITY_HIGH, $getSelection, $isRangeSelection } from 'lexical'

// Plugin to strip formatting on paste
export function PlainTextPastePlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        event.preventDefault()

        // Get plain text from clipboard
        const text = event.clipboardData?.getData('text/plain')
        if (!text) return false

        // Insert as plain text
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          selection.insertText(text)
        }

        return true // Prevent default Lexical paste handling
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor])

  return null
}
