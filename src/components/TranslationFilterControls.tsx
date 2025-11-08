import { useRef, useEffect } from 'react'
import { HStack, Input, InputGroup, Kbd, Menu, IconButton, Checkbox } from '@chakra-ui/react'
import { FiSearch, FiSliders } from 'react-icons/fi'

interface SearchableFields {
  source: boolean
  target: boolean
  notes: boolean
  rid: boolean
  sid: boolean
  guid: boolean
}

interface TranslationFilterControlsProps {
  showOnlyNonReviewed: boolean
  onShowOnlyNonReviewedChange: (checked: boolean) => void
  filterText: string
  onFilterTextChange: (text: string) => void
  searchableFields: SearchableFields
  onSearchableFieldsChange: (fields: SearchableFields) => void
}

export const TranslationFilterControls: React.FC<TranslationFilterControlsProps> = ({
  showOnlyNonReviewed,
  onShowOnlyNonReviewedChange,
  filterText,
  onFilterTextChange,
  searchableFields,
  onSearchableFieldsChange,
}) => {
  const filterInputRef = useRef<HTMLInputElement>(null)

  // Handle Cmd/Ctrl+K shortcut for filter focus
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        filterInputRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <HStack gap={2}>
      <Checkbox.Root
        checked={showOnlyNonReviewed}
        onCheckedChange={(e: any) => onShowOnlyNonReviewedChange(e.checked === true)}
        size="sm"
      >
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label>Only unreviewed</Checkbox.Label>
      </Checkbox.Root>
      <InputGroup
        width="200px"
        startElement={<FiSearch color="gray.500" />}
        endElement={
          <Kbd fontSize="xs" color="gray.500" bg="gray.100" px="1" py="0.5">
            {navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl+K'}
          </Kbd>
        }
      >
        <Input
          ref={filterInputRef}
          placeholder="Filter"
          size="sm"
          value={filterText}
          onChange={(e) => onFilterTextChange(e.target.value)}
          bg="rgba(255, 255, 255, 0.9)"
          borderColor="rgba(0, 0, 0, 0.2)"
          _focus={{
            borderColor: "blue.500",
            boxShadow: "0 0 0 1px rgba(66, 153, 225, 0.6)"
          }}
        />
      </InputGroup>
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton
            aria-label="Filter settings"
            size="sm"
            variant="ghost"
          >
            <FiSliders />
          </IconButton>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.CheckboxItem
              value="source"
              checked={searchableFields.source}
              onCheckedChange={(checked) => onSearchableFieldsChange({ ...searchableFields, source: checked })}
            >
              <Menu.ItemIndicator />
              Source
            </Menu.CheckboxItem>
            <Menu.CheckboxItem
              value="target"
              checked={searchableFields.target}
              onCheckedChange={(checked) => onSearchableFieldsChange({ ...searchableFields, target: checked })}
            >
              <Menu.ItemIndicator />
              Target
            </Menu.CheckboxItem>
            <Menu.CheckboxItem
              value="notes"
              checked={searchableFields.notes}
              onCheckedChange={(checked) => onSearchableFieldsChange({ ...searchableFields, notes: checked })}
            >
              <Menu.ItemIndicator />
              Notes
            </Menu.CheckboxItem>
            <Menu.CheckboxItem
              value="rid"
              checked={searchableFields.rid}
              onCheckedChange={(checked) => onSearchableFieldsChange({ ...searchableFields, rid: checked })}
            >
              <Menu.ItemIndicator />
              RID
            </Menu.CheckboxItem>
            <Menu.CheckboxItem
              value="sid"
              checked={searchableFields.sid}
              onCheckedChange={(checked) => onSearchableFieldsChange({ ...searchableFields, sid: checked })}
            >
              <Menu.ItemIndicator />
              SID
            </Menu.CheckboxItem>
            <Menu.CheckboxItem
              value="guid"
              checked={searchableFields.guid}
              onCheckedChange={(checked) => onSearchableFieldsChange({ ...searchableFields, guid: checked })}
            >
              <Menu.ItemIndicator />
              GUID
            </Menu.CheckboxItem>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    </HStack>
  )
}
