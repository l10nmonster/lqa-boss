import React, { useEffect, useCallback, useRef, forwardRef } from 'react'
import { $getRoot, $createParagraphNode, $createTextNode, $isElementNode, LexicalNode, EditorState, LexicalEditor as Editor, $getNodeByKey, COMMAND_PRIORITY_HIGH, KEY_BACKSPACE_COMMAND, KEY_DELETE_COMMAND, $getSelection, $isRangeSelection, KEY_ARROW_UP_COMMAND, KEY_ARROW_DOWN_COMMAND, $setSelection, $createRangeSelection } from 'lexical'
import {
  HeadingNode,
  QuoteNode
} from '@lexical/rich-text'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeNode } from '@lexical/code'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { Box } from '@chakra-ui/react'
import { NormalizedItem, NormalizedPlaceholder, PlaceholderDescription } from '../types'
import { TextNode, DecoratorNode, NodeKey } from 'lexical'

// Global store for placeholder descriptions
let globalPlaceholderDescriptions: { [key: string]: PlaceholderDescription } | undefined

// Custom node for non-editable placeholders
class PlaceholderNode extends DecoratorNode<React.ReactNode> {
  __placeholder: NormalizedPlaceholder
  __index: number

  static getType(): string {
    return 'placeholder'
  }

  static clone(node: PlaceholderNode): PlaceholderNode {
    return new PlaceholderNode(node.__placeholder, node.__index, node.__key)
  }

  constructor(placeholder: NormalizedPlaceholder, index: number, key?: NodeKey) {
    super(key)
    this.__placeholder = placeholder
    this.__index = index
  }

  // Make placeholder inline and non-selectable via keyboard
  isInline(): boolean {
    return true
  }

  isKeyboardSelectable(): boolean {
    return false
  }

  createDOM(): HTMLElement {
    const { v, s } = this.__placeholder

    // Build tooltip content
    let tooltipContent = `Code: ${v}`
    if (s) {
      tooltipContent += `\nSample: ${s}`
    }

    const span = document.createElement('span')
    span.setAttribute('data-lexical-decorator', 'true')
    span.setAttribute('data-placeholder-index', this.__index.toString())
    span.setAttribute('data-tooltip', tooltipContent)
    span.className = 'placeholder-with-tooltip'
    span.style.display = 'inline-block'
    span.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'
    span.style.padding = '2px 8px'
    span.style.borderRadius = '12px'
    span.style.border = '1px solid rgba(59, 130, 246, 0.4)'
    span.style.fontFamily = 'monospace'
    span.style.fontSize = '0.85em'
    span.style.fontWeight = '600'
    span.style.color = 'rgba(37, 99, 235, 1)'
    span.style.userSelect = 'none'
    span.style.cursor = 'grab'
    span.style.pointerEvents = 'auto'
    span.contentEditable = 'false'
    span.draggable = true
    
    // Add drag event listeners
    span.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/placeholder', JSON.stringify(this.__placeholder))
      e.dataTransfer?.setData('text/node-key', this.__key || '')
      e.dataTransfer?.setData('text/index', this.__index.toString())
      span.style.opacity = '0.5'
      span.style.cursor = 'grabbing'
      
      // Create a transparent drag image to hide the default drag ghost
      const dragImage = document.createElement('div')
      dragImage.style.position = 'absolute'
      dragImage.style.top = '-1000px'
      dragImage.style.left = '-1000px'
      dragImage.style.width = '1px'
      dragImage.style.height = '1px'
      dragImage.style.opacity = '0'
      dragImage.style.pointerEvents = 'none'
      document.body.appendChild(dragImage)
      
      // Set transparent drag image
      e.dataTransfer?.setDragImage(dragImage, 0, 0)
      
      // Clean up the drag image after a short delay
      setTimeout(() => {
        if (dragImage && dragImage.parentNode) {
          dragImage.parentNode.removeChild(dragImage)
        }
      }, 0)
    })
    
    span.addEventListener('dragend', () => {
      span.style.opacity = '1'
      span.style.cursor = 'grab'
    })

    return span
  }

  updateDOM(): false {
    return false
  }

  getTextContent(): string {
    return `{${this.__index}}`
  }

  decorate(): React.ReactNode {
    // Return just the content - styling and tooltip are handled by createDOM()
    return this.__index
  }

  static importJSON(serializedNode: any): PlaceholderNode {
    const { placeholder, index } = serializedNode
    return new PlaceholderNode(placeholder, index ?? 0)
  }

  exportJSON(): any {
    return {
      type: 'placeholder',
      placeholder: this.__placeholder,
      index: this.__index
    }
  }
}

function $createPlaceholderNode(placeholder: NormalizedPlaceholder, index: number): PlaceholderNode {
  return new PlaceholderNode(placeholder, index)
}

// Helper function to compare normalized content arrays
const arraysEqual = (a: NormalizedItem[], b: NormalizedItem[]): boolean => {
  if (a.length !== b.length) return false
  return a.every((item, index) => {
    const bItem = b[index]
    if (typeof item === 'string' && typeof bItem === 'string') {
      return item === bItem
    }
    if (typeof item === 'object' && typeof bItem === 'object') {
      return JSON.stringify(item) === JSON.stringify(bItem)
    }
    return false
  })
}

// Plugin to initialize editor with normalized content
interface InitializePluginProps {
  normalizedContent: NormalizedItem[]
}

function InitializePlugin({ normalizedContent }: InitializePluginProps): null {
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
    
    editor.getEditorState().read(() => {
      const currentContent = getCurrentContent()
      
      // Check if this is genuinely new external content
      const isNewExternalContent = !arraysEqual(normalizedContent, lastExternalContentRef.current)
      const isDifferentFromCurrent = !arraysEqual(normalizedContent, currentContent)
      
      if (!isInitializedRef.current || (isNewExternalContent && isDifferentFromCurrent)) {
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
    })
  }, [editor, normalizedContent])

  return null
}

// Plugin to handle drag and drop
function DragDropPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    let dragIndicator: HTMLElement | null = null

    const createDragIndicator = () => {
      const indicator = document.createElement('div')
      indicator.style.position = 'absolute'
      indicator.style.width = '2px'
      indicator.style.height = '20px'
      indicator.style.backgroundColor = '#3b82f6'
      indicator.style.borderRadius = '1px'
      indicator.style.pointerEvents = 'none'
      indicator.style.zIndex = '1000'
      indicator.style.opacity = '0'
      indicator.style.transition = 'opacity 0.15s ease-in-out'
      return indicator
    }

    const showDragIndicator = (x: number, y: number) => {
      if (!dragIndicator) {
        dragIndicator = createDragIndicator()
        document.body.appendChild(dragIndicator)
      }
      dragIndicator.style.left = `${x - 1}px`
      dragIndicator.style.top = `${y - 10}px`
      dragIndicator.style.opacity = '1'
    }

    const hideDragIndicator = () => {
      if (dragIndicator) {
        dragIndicator.style.opacity = '0'
      }
    }

    const removeDragIndicator = () => {
      if (dragIndicator) {
        document.body.removeChild(dragIndicator)
        dragIndicator = null
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer!.dropEffect = 'move'
      
      // Show caret indicator at drop position
      showDragIndicator(e.clientX, e.clientY)
    }

    const handleDragLeave = (e: DragEvent) => {
      // Only hide if we're actually leaving the editor
      const editorElement = editor.getRootElement()
      if (editorElement && !editorElement.contains(e.relatedTarget as Node)) {
        hideDragIndicator()
      }
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      hideDragIndicator()

      const placeholderData = e.dataTransfer?.getData('text/placeholder')
      const nodeKey = e.dataTransfer?.getData('text/node-key')
      const indexData = e.dataTransfer?.getData('text/index')

      if (!placeholderData || !nodeKey || !indexData) return

      const placeholder = JSON.parse(placeholderData) as NormalizedPlaceholder
      const index = parseInt(indexData, 10)

      editor.update(() => {
        // Remove the old node first
        const oldNode = $getNodeByKey(nodeKey)
        if (oldNode) {
          oldNode.remove()
        }

        // Get editor element
        const editorElement = editor.getRootElement()
        if (!editorElement) return

        // Try to use the browser's built-in coordinate-to-position API
        let targetNode: Node | null = null
        let targetOffset = 0

        if (document.caretRangeFromPoint) {
          const range = document.caretRangeFromPoint(e.clientX, e.clientY)
          if (range) {
            targetNode = range.startContainer
            targetOffset = range.startOffset
          }
        } else if ((document as any).caretPositionFromPoint) {
          const caretPos = (document as any).caretPositionFromPoint(e.clientX, e.clientY)
          if (caretPos) {
            targetNode = caretPos.offsetNode
            targetOffset = caretPos.offset
          }
        }

        // Find the target paragraph based on the drop coordinates
        const root = $getRoot()
        const paragraphs = root.getChildren()

        let targetParagraph: LexicalNode | null = null

        // Find which paragraph contains the drop point
        for (const para of paragraphs) {
          if (!$isElementNode(para)) continue
          const paraElement = editor.getElementByKey(para.getKey())
          if (paraElement) {
            const rect = paraElement.getBoundingClientRect()
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
              targetParagraph = para
              break
            }
          }
        }

        // If no paragraph found, use the first one or last one based on Y position
        if (!targetParagraph && paragraphs.length > 0) {
          const firstPara = paragraphs[0]
          const lastPara = paragraphs[paragraphs.length - 1]
          if ($isElementNode(firstPara) && $isElementNode(lastPara)) {
            const firstRect = editor.getElementByKey(firstPara.getKey())?.getBoundingClientRect()
            const lastRect = editor.getElementByKey(lastPara.getKey())?.getBoundingClientRect()
            if (firstRect && lastRect) {
              targetParagraph = e.clientY < firstRect.top ? firstPara : lastPara
            }
          }
        }

        if (!targetParagraph || !$isElementNode(targetParagraph)) return

        const newPlaceholderNode = $createPlaceholderNode(placeholder, index)
        let cursorPlacementNode: LexicalNode | null = null
        let cursorOffset = 0
        let cursorType: 'text' | 'element' = 'element'
        let placeholderInserted = false

        if (targetNode && targetNode.nodeType === Node.TEXT_NODE) {
          // Find the corresponding Lexical text node
          const children = targetParagraph.getChildren()

          for (let i = 0; i < children.length; i++) {
            const child = children[i]
            if (child instanceof TextNode) {
              const domNode = editor.getElementByKey(child.getKey())
              if (domNode && (domNode.firstChild === targetNode || domNode === targetNode.parentNode)) {
                // Split the text node at the target offset
                if (targetOffset === 0) {
                  // Insert before this text node
                  child.insertBefore(newPlaceholderNode)
                  // Position cursor after the placeholder
                  cursorPlacementNode = child
                  cursorOffset = 0
                  cursorType = 'text'
                  placeholderInserted = true
                } else if (targetOffset >= child.getTextContent().length) {
                  // Insert after this text node
                  child.insertAfter(newPlaceholderNode)
                  // Check if there's a next sibling after the placeholder
                  const afterPlaceholder = newPlaceholderNode.getNextSibling()
                  if (afterPlaceholder instanceof TextNode) {
                    cursorPlacementNode = afterPlaceholder
                    cursorOffset = 0
                    cursorType = 'text'
                  } else {
                    // Position cursor after placeholder
                    const parent = newPlaceholderNode.getParent()
                    if (parent && $isElementNode(parent)) {
                      const siblings = parent.getChildren()
                      const phIndex = siblings.indexOf(newPlaceholderNode)
                      cursorPlacementNode = parent
                      cursorOffset = phIndex + 1
                      cursorType = 'element'
                    }
                  }
                  placeholderInserted = true
                } else {
                  // Split the text node
                  const textContent = child.getTextContent()
                  const beforeText = textContent.substring(0, targetOffset)
                  const afterText = textContent.substring(targetOffset)

                  if (!beforeText && !afterText) {
                    // Entire text node is empty, replace it with placeholder
                    child.insertBefore(newPlaceholderNode)
                    child.remove()
                    // Position cursor after placeholder
                    const parent = newPlaceholderNode.getParent()
                    if (parent && $isElementNode(parent)) {
                      const siblings = parent.getChildren()
                      const phIndex = siblings.indexOf(newPlaceholderNode)
                      cursorPlacementNode = parent
                      cursorOffset = phIndex + 1
                      cursorType = 'element'
                    }
                  } else if (!beforeText && afterText) {
                    // No text before drop point, keep the afterText in the node
                    child.setTextContent(afterText)
                    child.insertBefore(newPlaceholderNode)
                    // Position cursor at start of text
                    cursorPlacementNode = child
                    cursorOffset = 0
                    cursorType = 'text'
                  } else if (beforeText && !afterText) {
                    // No text after drop point
                    child.setTextContent(beforeText)
                    child.insertAfter(newPlaceholderNode)
                    // Position cursor after placeholder
                    const parent = newPlaceholderNode.getParent()
                    if (parent && $isElementNode(parent)) {
                      const siblings = parent.getChildren()
                      const phIndex = siblings.indexOf(newPlaceholderNode)
                      cursorPlacementNode = parent
                      cursorOffset = phIndex + 1
                      cursorType = 'element'
                    }
                  } else {
                    // Both beforeText and afterText exist - need to split
                    child.setTextContent(beforeText)
                    child.insertAfter(newPlaceholderNode)
                    const afterTextNode = $createTextNode(afterText)
                    newPlaceholderNode.insertAfter(afterTextNode)
                    // Position cursor at start of after text
                    cursorPlacementNode = afterTextNode
                    cursorOffset = 0
                    cursorType = 'text'
                  }
                  placeholderInserted = true
                }
                break
              }
            }
          }
        }

        // Fallback: find insertion point based on coordinates (only if not already inserted)
        if (!placeholderInserted) {
          const children = targetParagraph.getChildren()
          const dropX = e.clientX

          let insertIndex = children.length // Default to end

          for (let i = 0; i < children.length; i++) {
            const child = children[i]
            const childElement = editor.getElementByKey(child.getKey())

            if (childElement) {
              const rect = childElement.getBoundingClientRect()
              const midPoint = rect.left + rect.width / 2

              if (dropX < midPoint) {
                insertIndex = i
                break
              }
            }
          }

          // Insert at the determined position
          if (insertIndex >= children.length) {
            targetParagraph.append(newPlaceholderNode)
            // Position cursor after the placeholder (at end of paragraph)
            cursorPlacementNode = targetParagraph
            cursorOffset = targetParagraph.getChildren().length
            cursorType = 'element'
          } else {
            const nodeAtIndex = children[insertIndex]
            nodeAtIndex.insertBefore(newPlaceholderNode)

            // Position cursor after the placeholder
            if (nodeAtIndex instanceof TextNode) {
              cursorPlacementNode = nodeAtIndex
              cursorOffset = 0
              cursorType = 'text'
            } else {
              // Use element-level positioning - get fresh children list
              const updatedChildren = targetParagraph.getChildren()
              const newIndex = updatedChildren.indexOf(newPlaceholderNode)
              if (newIndex >= 0) {
                cursorPlacementNode = targetParagraph
                cursorOffset = newIndex + 1
                cursorType = 'element'
              }
            }
          }
        }

        // Set cursor position after drop
        if (cursorPlacementNode) {
          try {
            const newSelection = $createRangeSelection()
            newSelection.anchor.set(cursorPlacementNode.getKey(), cursorOffset, cursorType)
            newSelection.focus.set(cursorPlacementNode.getKey(), cursorOffset, cursorType)
            $setSelection(newSelection)
          } catch (error) {
            console.debug('Could not set cursor after drop:', error)
          }
        }

      }, { tag: 'drop-placeholder' })
    }

    const editorElement = editor.getRootElement()
    if (editorElement) {
      editorElement.addEventListener('dragover', handleDragOver)
      editorElement.addEventListener('dragleave', handleDragLeave)
      editorElement.addEventListener('drop', handleDrop)
      
      return () => {
        editorElement.removeEventListener('dragover', handleDragOver)
        editorElement.removeEventListener('dragleave', handleDragLeave)
        editorElement.removeEventListener('drop', handleDrop)
        removeDragIndicator()
      }
    }
  }, [editor])

  return null
}

// Plugin to handle focus and cursor positioning
function FocusPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Don't interfere with placeholder clicks
      if ((e.target as HTMLElement).closest('[data-lexical-decorator="true"]')) {
        return
      }

      // Focus the editor to ensure proper cursor behavior
      editor.focus()
    }

    const editorElement = editor.getRootElement()
    if (editorElement) {
      editorElement.addEventListener('click', handleClick)

      return () => {
        editorElement.removeEventListener('click', handleClick)
      }
    }
  }, [editor])

  return null
}


// Plugin to prevent deletion of placeholders via keyboard
function KeyboardProtectionPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const removeBackspaceCommand = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      (event) => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false

        // If selection is not collapsed, check if it contains placeholders
        if (!selection.isCollapsed()) {
          const nodes = selection.getNodes()
          const hasPlaceholder = nodes.some(node => node instanceof PlaceholderNode)
          if (hasPlaceholder) {
            event?.preventDefault()
            return true
          }
        } else {
          // Selection is collapsed (just a cursor)
          const anchor = selection.anchor
          let anchorNode = anchor.getNode()
          const offset = anchor.offset

          // If anchor is a PlaceholderNode itself, prevent deletion
          if (anchorNode instanceof PlaceholderNode) {
            event?.preventDefault()
            return true
          }

          // Case 1: Cursor in a TextNode
          if (anchorNode instanceof TextNode) {
            // Check if cursor is at the beginning of the text node
            if (offset === 0) {
              const parent = anchorNode.getParent()
              if ($isElementNode(parent)) {
                const prevSibling = anchorNode.getPreviousSibling()
                if (prevSibling instanceof PlaceholderNode) {
                  event?.preventDefault()
                  return true
                }
              }
            }
          }
          // Case 2: Cursor in an ElementNode (e.g., paragraph)
          else if ($isElementNode(anchorNode)) {
            const children = anchorNode.getChildren()
            // Check if there's a placeholder right before the cursor position
            if (offset > 0 && offset <= children.length) {
              const prevChild = children[offset - 1]
              if (prevChild instanceof PlaceholderNode) {
                event?.preventDefault()
                return true
              }
            }
          }
        }

        return false
      },
      COMMAND_PRIORITY_HIGH
    )

    const removeDeleteCommand = editor.registerCommand(
      KEY_DELETE_COMMAND,
      (event) => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false

        // If selection is not collapsed, check if it contains placeholders
        if (!selection.isCollapsed()) {
          const nodes = selection.getNodes()
          const hasPlaceholder = nodes.some(node => node instanceof PlaceholderNode)
          if (hasPlaceholder) {
            event?.preventDefault()
            return true
          }
        } else {
          // Selection is collapsed (just a cursor)
          const anchor = selection.anchor
          let anchorNode = anchor.getNode()
          const offset = anchor.offset

          // If anchor is a PlaceholderNode itself, prevent deletion
          if (anchorNode instanceof PlaceholderNode) {
            event?.preventDefault()
            return true
          }

          // Case 1: Cursor in a TextNode
          if (anchorNode instanceof TextNode) {
            const text = anchorNode.getTextContent()
            const textLength = text.length

            // Check if cursor is at the end of the text node
            if (offset === textLength) {
              const parent = anchorNode.getParent()
              if ($isElementNode(parent)) {
                const nextSibling = anchorNode.getNextSibling()
                if (nextSibling instanceof PlaceholderNode) {
                  event?.preventDefault()
                  return true
                }
              }
            }
          }
          // Case 2: Cursor in an ElementNode (e.g., paragraph)
          else if ($isElementNode(anchorNode)) {
            const children = anchorNode.getChildren()
            // Check if there's a placeholder right at the cursor position
            if (offset < children.length) {
              const nextChild = children[offset]
              if (nextChild instanceof PlaceholderNode) {
                event?.preventDefault()
                return true
              }
            }
          }
        }

        return false
      },
      COMMAND_PRIORITY_HIGH
    )

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
      removeBackspaceCommand()
      removeDeleteCommand()
      removeUpArrowCommand()
      removeDownArrowCommand()
    }
  }, [editor])

  return null
}

interface NormalizedTextEditorProps {
  normalizedContent: NormalizedItem[]
  onChange: (normalizedContent: NormalizedItem[]) => void
  onFocus?: () => void
  isActive?: boolean
  placeholderDescriptions?: { [key: string]: { sample?: string, desc?: string } }
}

export interface NormalizedTextEditorRef {
  blur: () => void
  forceUpdate: (content: NormalizedItem[]) => void
}

// Plugin to expose editor methods via ref
function EditorRefPlugin({ editorRef }: { editorRef: React.RefObject<NormalizedTextEditorRef | null> }): null {
  const [editor] = useLexicalComposerContext()

  React.useImperativeHandle(editorRef, () => ({
    blur: () => {
      editor.blur()
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

const NormalizedTextEditor = forwardRef<NormalizedTextEditorRef, NormalizedTextEditorProps>(({
  normalizedContent,
  onChange,
  onFocus,
  isActive,
  placeholderDescriptions
}, ref) => {
  const lastEmittedContentRef = useRef<NormalizedItem[]>([])
  const editorRef = useRef<NormalizedTextEditorRef>(null)

  // Update global placeholder descriptions whenever they change
  useEffect(() => {
    globalPlaceholderDescriptions = placeholderDescriptions
  }, [placeholderDescriptions])

  // Add global styles and tooltip handler
  useEffect(() => {
    const styleId = 'placeholder-tooltip-styles'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        .placeholder-tooltip-container {
          position: fixed;
          background-color: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          white-space: pre-line;
          pointer-events: none;
          z-index: 10000;
          max-width: 250px;
          opacity: 0;
          transition: opacity 0s;
        }
        .placeholder-tooltip-container.visible {
          opacity: 1;
        }
      `
      document.head.appendChild(style)
    }

    let tooltipElement: HTMLDivElement | null = null

    const showTooltip = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('placeholder-with-tooltip')) {
        const tooltipText = target.getAttribute('data-tooltip')
        if (!tooltipText) return

        // Get placeholder index and check for description
        const placeholderIndex = target.getAttribute('data-placeholder-index')
        let fullTooltip = tooltipText

        if (placeholderIndex && globalPlaceholderDescriptions) {
          const phKey = `{${parseInt(placeholderIndex) - 1}}`
          const phDesc = globalPlaceholderDescriptions[phKey]
          if (phDesc?.desc) {
            fullTooltip += `\n\n${phDesc.desc}`
          }
        }

        // Create tooltip if it doesn't exist
        if (!tooltipElement) {
          tooltipElement = document.createElement('div')
          tooltipElement.className = 'placeholder-tooltip-container'
          document.body.appendChild(tooltipElement)
        }

        tooltipElement.textContent = fullTooltip

        // Position the tooltip
        const rect = target.getBoundingClientRect()
        const tooltipRect = tooltipElement.getBoundingClientRect()

        let top = rect.top - tooltipRect.height - 8
        let left = rect.left + rect.width / 2 - tooltipRect.width / 2

        // Check if tooltip would go above viewport
        if (top < 10) {
          // Position below instead
          top = rect.bottom + 8
        }

        // Check if tooltip would go off left edge
        if (left < 10) {
          left = 10
        }

        // Check if tooltip would go off right edge
        const maxLeft = window.innerWidth - tooltipRect.width - 10
        if (left > maxLeft) {
          left = maxLeft
        }

        tooltipElement.style.top = `${top}px`
        tooltipElement.style.left = `${left}px`
        tooltipElement.classList.add('visible')
      }
    }

    const hideTooltip = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('placeholder-with-tooltip') && tooltipElement) {
        tooltipElement.classList.remove('visible')
      }
    }

    document.addEventListener('mouseover', showTooltip)
    document.addEventListener('mouseout', hideTooltip)

    return () => {
      document.removeEventListener('mouseover', showTooltip)
      document.removeEventListener('mouseout', hideTooltip)
      if (tooltipElement && tooltipElement.parentNode) {
        tooltipElement.parentNode.removeChild(tooltipElement)
      }
    }
  }, [])

  // Connect the forwarded ref to our internal ref
  React.useImperativeHandle(ref, () => ({
    blur: () => editorRef.current?.blur(),
    forceUpdate: (content: NormalizedItem[]) => editorRef.current?.forceUpdate(content)
  }), [])

  const initialConfig = {
    namespace: 'NormalizedTextEditor',
    theme: {
      text: {
        bold: 'text-bold',
        italic: 'text-italic',
        underline: 'text-underline',
      },
    },
    onError: (error: Error) => {
      console.error('Lexical error:', error)
    },
    nodes: [
      PlaceholderNode,
      HeadingNode,
      QuoteNode,
      ListItemNode,
      ListNode,
      CodeNode,
      AutoLinkNode,
      LinkNode
    ]
  }

  const handleChange = useCallback((editorState: EditorState, _editor: Editor, tags: Set<string>) => {
    if (tags.has('initial-load') || tags.has('content-update')) {
      return
    }

    editorState.read(() => {
      const root = $getRoot()
      const paragraphs = root.getChildren()

      if (paragraphs.length === 0) {
        const emptyContent: NormalizedItem[] = []
        if (!arraysEqual(emptyContent, lastEmittedContentRef.current)) {
          lastEmittedContentRef.current = emptyContent
          onChange(emptyContent)
        }
        return
      }

      const newNormalized: NormalizedItem[] = []

      paragraphs.forEach((paragraph, paragraphIdx) => {
        if (!$isElementNode(paragraph)) return

        const children = paragraph.getChildren()

        children.forEach((node: LexicalNode) => {
          if (node instanceof TextNode) {
            const text = node.getTextContent()
            if (text) {
              newNormalized.push(text)
            }
          } else if (node instanceof PlaceholderNode) {
            newNormalized.push(node.__placeholder)
          }
        })

        // Add newline after each paragraph except the last
        if (paragraphIdx < paragraphs.length - 1) {
          // Append newline to the last text item, or create a new text item
          if (newNormalized.length > 0 && typeof newNormalized[newNormalized.length - 1] === 'string') {
            newNormalized[newNormalized.length - 1] = (newNormalized[newNormalized.length - 1] as string) + '\n'
          } else {
            newNormalized.push('\n')
          }
        }
      })

      // Only emit onChange if content has actually changed
      if (!arraysEqual(newNormalized, lastEmittedContentRef.current)) {
        lastEmittedContentRef.current = [...newNormalized]
        onChange(newNormalized)
      }
    })
  }, [onChange])

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <Box
        position="relative"
        onClick={onFocus}
        borderRadius="md"
        p={2}
        bg={isActive ? 'rgba(59, 130, 246, 0.08)' : 'transparent'}
        backdropFilter={isActive ? 'blur(5px)' : 'none'}
        _hover={{
          bg: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(5px)'
        }}
        transition="all 0.2s"
        minWidth={0}
        maxW="100%"
        overflowWrap="break-word"
      >
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              style={{
                minHeight: '32px',
                outline: 'none',
                color: '#374151',
                fontSize: '16px',
                fontWeight: 'normal',
                lineHeight: '1.6',
                cursor: 'text',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                maxWidth: '100%',
              }}
              className="lexical-editor-content"
            />
          }
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <OnChangePlugin onChange={handleChange} />
        <HistoryPlugin />
        <FocusPlugin />
        <KeyboardProtectionPlugin />
        <InitializePlugin normalizedContent={normalizedContent} />
        <DragDropPlugin />
        <EditorRefPlugin editorRef={editorRef} />
      </Box>
    </LexicalComposer>
  )
})

export default NormalizedTextEditor 