"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
    value: string; // Should be unique ID
    label: string; // Display name
    description?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string; // The current display label (the "name" of the task)
  onValueChange: (label: string, option?: ComboboxOption) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  onCustomValueCreate?: (value: string) => void;
}

export function Combobox({
    options,
    value,
    onValueChange,
    placeholder = "Select an option...",
    emptyMessage = "No option found.",
    className,
    onCustomValueCreate
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const handleSelect = (selectedValue: string) => {
    // selectedValue is now the unique ID (option.value) or the search term for new items
    const selectedOption = options.find(o => o.value.toLowerCase() === selectedValue.toLowerCase());
    
    if (selectedOption) {
      onValueChange(selectedOption.label, selectedOption);
    } else if (onCustomValueCreate) {
      // If no option is found by ID, it must be the "create" action. The value is the search term.
      onCustomValueCreate(selectedValue);
    }
    
    setOpen(false);
  };
  
  // When the popover closes, reset the search input to show the full list next time
  React.useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const showCreateOption = onCustomValueCreate && search.trim().length > 0 && !options.some(o => o.label.toLowerCase() === search.trim().toLowerCase());
  const selectedOptionValue = options.find(o => o.label === value)?.value;


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
            <span className="truncate">
                {value || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput 
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
                { !showCreateOption ? emptyMessage : null }
            </CommandEmpty>
            <CommandGroup>
              {options
                .filter(option => option.label.toLowerCase().includes(search.toLowerCase()))
                .map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value} // Use the unique ID as the value
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedOptionValue === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div>
                    {option.label}
                    {option.description && (
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {showCreateOption && (
                <CommandGroup>
                  <CommandItem
                      key={search}
                      value={search} // The value here is the search term itself
                      onSelect={handleSelect}
                  >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      <span>Create "{search}"</span>
                  </CommandItem>
                </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
