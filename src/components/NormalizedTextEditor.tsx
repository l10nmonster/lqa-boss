import React, { useEffect, useCallback } from 'react'
import { $getRoot, $createParagraphNode, $createTextNode, $isElementNode, LexicalNode, EditorState, LexicalEditor as Editor, $getSelection, $isRangeSelection, $getNodeByKey } from 'lexical'
import { 
  $createHeadingNode,
  $createQuoteNode,
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
import { NormalizedItem, NormalizedPlaceholder } from '../types'
import { TextNode, DecoratorNode, NodeKey } from 'lexical'

// Custom node for non-editable placeholders
export class PlaceholderNode extends DecoratorNode<React.ReactNode> {
  __placeholder: NormalizedPlaceholder

  static getType(): string {
    return 'placeholder'
  }

  static clone(node: PlaceholderNode): PlaceholderNode {
    return new PlaceholderNode(node.__placeholder, node.__key)
  }

  constructor(placeholder: NormalizedPlaceholder, key?: NodeKey) {
    super(key)
    this.__placeholder = placeholder
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span')
    span.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'
    span.style.padding = '2px 4px'
    span.style.borderRadius = '4px'
    span.style.fontFamily = 'monospace'
    span.style.fontSize = '0.9em'
    span.style.userSelect = 'none'
    span.style.cursor = 'grab'
    span.contentEditable = 'false'
    span.draggable = true
    
    // Add drag event listeners
    span.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/placeholder', JSON.stringify(this.__placeholder))
      e.dataTransfer?.setData('text/node-key', this.__key || '')
      span.style.opacity = '0.5'
      span.style.cursor = 'grabbing'
    })
    
    span.addEventListener('dragend', (e) => {
      span.style.opacity = '1'
      span.style.cursor = 'grab'
    })
    
    return span
  }

  updateDOM(): false {
    return false
  }

  getTextContent(): string {
    const { t, v, s } = this.__placeholder
    if (t === 'x' && s) return s
    if (t === 'bx' || t === 'ex') {
      const match = v.match(/<\/?([a-zA-Z]+)/)
      const tagName = match ? match[1] : 'tag'
      return t === 'bx' ? `<${tagName}>` : `</${tagName}>`
    }
    return v
  }

  decorate(): React.ReactNode {
    const { t, v, s } = this.__placeholder
    let display = v
    
    if (t === 'x' && s) {
      display = s
    } else if (t === 'bx' || t === 'ex') {
      const match = v.match(/<\/?([a-zA-Z]+)/)
      const tagName = match ? match[1] : 'tag'
      display = t === 'bx' ? `<${tagName}>` : `</${tagName}>`
    }
    
    return (
      <span 
        draggable
        style={{
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          padding: '2px 4px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '0.9em',
          cursor: 'grab',
          userSelect: 'none'
        }}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/placeholder', JSON.stringify(this.__placeholder))
          e.dataTransfer.setData('text/node-key', this.__key || '')
          e.currentTarget.style.opacity = '0.5'
        }}
        onDragEnd={(e) => {
          e.currentTarget.style.opacity = '1'
        }}
      >
        {display}
      </span>
    )
  }

  static importJSON(serializedNode: any): PlaceholderNode {
    const { placeholder } = serializedNode
    return new PlaceholderNode(placeholder)
  }

  exportJSON(): any {
    return {
      type: 'placeholder',
      placeholder: this.__placeholder
    }
  }
}

function $createPlaceholderNode(placeholder: NormalizedPlaceholder): PlaceholderNode {
  return new PlaceholderNode(placeholder)
}

// Plugin to initialize editor with normalized content
interface InitializePluginProps {
  normalizedContent: NormalizedItem[]
}

function InitializePlugin({ normalizedContent }: InitializePluginProps): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    editor.update(() => {
      const root = $getRoot()
      root.clear()
      
      const paragraph = $createParagraphNode()
      
      normalizedContent.forEach(item => {
        if (typeof item === 'string') {
          paragraph.append($createTextNode(item))
        } else {
          paragraph.append($createPlaceholderNode(item))
        }
      })
      
      root.append(paragraph)
    }, { tag: 'content-update' })
  }, [editor, normalizedContent])

  return null
}

// Plugin to handle drag and drop
function DragDropPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer!.dropEffect = 'move'
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      
      const placeholderData = e.dataTransfer?.getData('text/placeholder')
      const nodeKey = e.dataTransfer?.getData('text/node-key')
      
      if (!placeholderData || !nodeKey) return

      const placeholder = JSON.parse(placeholderData) as NormalizedPlaceholder
      
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

        // Find the Lexical node that corresponds to the DOM node
        const root = $getRoot()
        const paragraph = root.getFirstChild()
        
        if (!$isElementNode(paragraph)) return

        const newPlaceholderNode = $createPlaceholderNode(placeholder)

        if (targetNode && targetNode.nodeType === Node.TEXT_NODE) {
          // Find the corresponding Lexical text node
          const children = paragraph.getChildren()
          
          for (let i = 0; i < children.length; i++) {
            const child = children[i]
            if (child instanceof TextNode) {
              const domNode = editor.getElementByKey(child.getKey())
              if (domNode && (domNode.firstChild === targetNode || domNode === targetNode.parentNode)) {
                // Split the text node at the target offset
                if (targetOffset === 0) {
                  // Insert before this text node
                  child.insertBefore(newPlaceholderNode)
                } else if (targetOffset >= child.getTextContent().length) {
                  // Insert after this text node
                  child.insertAfter(newPlaceholderNode)
                } else {
                  // Split the text node
                  const textContent = child.getTextContent()
                  const beforeText = textContent.substring(0, targetOffset)
                  const afterText = textContent.substring(targetOffset)
                  
                  // Replace the original text node with the split version
                  child.setTextContent(beforeText)
                  const afterTextNode = $createTextNode(afterText)
                  child.insertAfter(afterTextNode)
                  child.insertAfter(newPlaceholderNode)
                }
                return
              }
            }
          }
        }

        // Fallback: find insertion point based on coordinates
        const children = paragraph.getChildren()
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
          paragraph.append(newPlaceholderNode)
        } else {
          const nodeAtIndex = children[insertIndex]
          nodeAtIndex.insertBefore(newPlaceholderNode)
        }
      })
    }

    const editorElement = editor.getRootElement()
    if (editorElement) {
      editorElement.addEventListener('dragover', handleDragOver)
      editorElement.addEventListener('drop', handleDrop)
      
      return () => {
        editorElement.removeEventListener('dragover', handleDragOver)
        editorElement.removeEventListener('drop', handleDrop)
      }
    }
  }, [editor])

  return null
}

interface NormalizedTextEditorProps {
  normalizedContent: NormalizedItem[]
  onChange: (normalizedContent: NormalizedItem[]) => void
  onFocus?: () => void
  isActive?: boolean
}

const NormalizedTextEditor: React.FC<NormalizedTextEditorProps> = ({
  normalizedContent,
  onChange,
  onFocus,
  isActive
}) => {
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

  const handleChange = useCallback((editorState: EditorState, editor: Editor, tags: Set<string>) => {
    if (tags.has('initial-load') || tags.has('content-update')) {
      return
    }

    editorState.read(() => {
      const root = $getRoot()
      const firstChild = root.getFirstChild()

      if (!$isElementNode(firstChild)) {
        onChange([])
        return
      }

      const newNormalized: NormalizedItem[] = []
      firstChild.getChildren().forEach((node: LexicalNode) => {
        if (node instanceof TextNode) {
          const text = node.getTextContent()
          if (text) newNormalized.push(text)
        } else if (node instanceof PlaceholderNode) {
          newNormalized.push(node.__placeholder)
        }
      })
      
      onChange(newNormalized)
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
      >
        <RichTextPlugin
          contentEditable={
            <ContentEditable 
              style={{
                minHeight: '32px',
                outline: 'none',
                color: '#374151',
                fontSize: '16px',
                fontWeight: '500',
                lineHeight: '1.6',
              }}
            />
          }
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <OnChangePlugin onChange={handleChange} />
        <HistoryPlugin />
        <InitializePlugin normalizedContent={normalizedContent} />
        <DragDropPlugin />
      </Box>
    </LexicalComposer>
  )
}

export default NormalizedTextEditor 