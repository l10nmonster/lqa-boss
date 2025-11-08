import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { COMMAND_PRIORITY_HIGH, KEY_ENTER_COMMAND } from 'lexical'

/**
 * Plugin to prevent Cmd+Enter (or Ctrl+Enter) from inserting a newline
 * This allows the parent keyboard navigation handler to handle the navigation
 * without Chrome inserting a newline first
 */
export function KeyboardShortcutPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        // Intercept Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
        if (event && (event.metaKey || event.ctrlKey)) {
          // Prevent the default Enter behavior (newline insertion)
          event.preventDefault()
          // Return true to stop further processing of this command
          return true
        }
        // Allow normal Enter key to work as expected
        return false
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor])

  return null
}
