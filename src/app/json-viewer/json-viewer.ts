import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface JsonLine {
  id: string;
  content: string;
  level: number;
  hasToggle: boolean;
  isCollapsed: boolean;
  parentId: string | null;
  lineNumber: number;
  isClosing: boolean;
  originalKey: string | null;
  isArray: boolean;
  isObject: boolean;
  childCount: number;
}

@Component({
  selector: 'app-json-viewer',
  imports: [CommonModule],
  templateUrl: './json-viewer.html',
  styleUrl: './json-viewer.css',
})
export class JsonViewer {
  allLines: JsonLine[] = [];
  displayLines = signal<JsonLine[]>([]);
  activeLineIndex = signal<number>(-1);
  fileName = signal<string>('');
  rawJsonText = signal<string>('');
  viewMode = signal<'formatted' | 'textarea'>('formatted');
  isEditMode = signal<boolean>(false);
  editedText = signal<string>('');
  validationError = signal<string>('');
  editLines = signal<JsonLine[]>([]);
  editAllLines: JsonLine[] = [];
  hasUnsavedChanges = signal<boolean>(false);
  isValidJson = signal<boolean>(true);
  successMessage = signal<string>('');
  textareaContent = signal<string>('');
  editableContent = signal<string>('');
  showFormattedView = signal<boolean>(false);
  editTextareaValue = signal<string>('');

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!file.name.endsWith('.json')) {
      alert('Please upload a valid .json file');
      input.value = '';
      return;
    }

    this.fileName.set(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const jsonData = JSON.parse(content);
        const formattedJson = JSON.stringify(jsonData, null, 2);
        this.rawJsonText.set(formattedJson);
        this.textareaContent.set(formattedJson);
        this.parseAndDisplay(jsonData);
        this.successMessage.set('JSON file loaded successfully!');
        setTimeout(() => this.successMessage.set(''), 3000);
      } catch (error) {
        alert('Invalid JSON file. Please upload a valid JSON file.');
        this.displayLines.set([]);
        this.rawJsonText.set('');
        this.textareaContent.set('');
        this.fileName.set('');
        input.value = '';
      }
    };

    reader.readAsText(file);
  }

  private parseAndDisplay(data: any): void {
    this.allLines = [];
    let idCounter = 0;
    
    const generateId = () => `line-${idCounter++}`;
    
    const buildLines = (value: any, key: string | null, level: number, parentId: string | null): string => {
      const currentId = generateId();
      const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
      const isArray = Array.isArray(value);
      const hasChildren = isObject || isArray;
      
      // Opening line
      let content = '  '.repeat(level);
      
      if (key !== null) {
        content += `<span class="key">"${key}"</span><span class="colon">: </span>`;
      }
      
      if (isObject) {
        const keys = Object.keys(value);
        content += '<span class="bracket">{</span>';
        this.allLines.push({
          id: currentId,
          content,
          level,
          hasToggle: true,
          isCollapsed: false,
          parentId,
          lineNumber: 0,
          isClosing: false,
          originalKey: key,
          isArray: false,
          isObject: true,
          childCount: keys.length
        });
        
        keys.forEach((k, index) => {
          const childId = buildLines(value[k], k, level + 1, currentId);
          if (index < keys.length - 1) {
            const lastLine = this.allLines[this.allLines.length - 1];
            lastLine.content += '<span class="comma">,</span>';
          }
        });
        
        // Closing brace
        const closeId = generateId();
        this.allLines.push({
          id: closeId,
          content: '  '.repeat(level) + '<span class="bracket">}</span>',
          level,
          hasToggle: false,
          isCollapsed: false,
          parentId: currentId,
          lineNumber: 0,
          isClosing: true,
          originalKey: null,
          isArray: false,
          isObject: false,
          childCount: 0
        });
        
      } else if (isArray) {
        content += '<span class="bracket">[</span>';
        this.allLines.push({
          id: currentId,
          content,
          level,
          hasToggle: true,
          isCollapsed: false,
          parentId,
          lineNumber: 0,
          isClosing: false,
          originalKey: key,
          isArray: true,
          isObject: false,
          childCount: value.length
        });
        
        value.forEach((item: any, index: number) => {
          const childId = buildLines(item, null, level + 1, currentId);
          if (index < value.length - 1) {
            const lastLine = this.allLines[this.allLines.length - 1];
            lastLine.content += '<span class="comma">,</span>';
          }
        });
        
        // Closing bracket
        const closeId = generateId();
        this.allLines.push({
          id: closeId,
          content: '  '.repeat(level) + '<span class="bracket">]</span>',
          level,
          hasToggle: false,
          isCollapsed: false,
          parentId: currentId,
          lineNumber: 0,
          isClosing: true,
          originalKey: null,
          isArray: false,
          isObject: false,
          childCount: 0
        });
        
      } else {
        // Primitive value
        if (typeof value === 'string') {
          content += `<span class="value-string">"${value}"</span>`;
        } else if (typeof value === 'number') {
          content += `<span class="value-number">${value}</span>`;
        } else if (typeof value === 'boolean') {
          content += `<span class="value-boolean">${value}</span>`;
        } else if (value === null) {
          content += `<span class="value-null">null</span>`;
        }
        
        this.allLines.push({
          id: currentId,
          content,
          level,
          hasToggle: false,
          isCollapsed: false,
          parentId,
          lineNumber: 0,
          isClosing: false,
          originalKey: key,
          isArray: false,
          isObject: false,
          childCount: 0
        });
      }
      
      return currentId;
    };
    
    buildLines(data, null, 0, null);
    this.updateDisplayLines();
  }

  private updateDisplayLines(): void {
    const visibleLines: JsonLine[] = [];
    const collapsedParents = new Set<string>();
    
    // Find all collapsed parents
    this.allLines.forEach(line => {
      if (line.isCollapsed) {
        collapsedParents.add(line.id);
      }
    });
    
    // Filter visible lines
    for (const line of this.allLines) {
      let shouldShow = true;
      
      // Check if any ancestor is collapsed
      let currentParentId = line.parentId;
      while (currentParentId) {
        if (collapsedParents.has(currentParentId)) {
          shouldShow = false;
          break;
        }
        const parent = this.allLines.find(l => l.id === currentParentId);
        currentParentId = parent?.parentId || null;
      }
      
      if (shouldShow) {
        visibleLines.push(line);
      }
    }
    
    // Assign line numbers
    visibleLines.forEach((line, index) => {
      line.lineNumber = index + 1;
    });
    
    this.displayLines.set(visibleLines);
  }

  toggleCollapse(lineId: string): void {
    const line = this.allLines.find(l => l.id === lineId);
    if (line && line.hasToggle) {
      line.isCollapsed = !line.isCollapsed;
      
      // Update the content to show collapsed state
      if (line.isCollapsed) {
        const indent = '  '.repeat(line.level);
        const keyPart = line.originalKey ? `<span class="key">"${line.originalKey}"</span><span class="colon">: </span>` : '';
        
        if (line.isObject) {
          line.content = `${indent}${keyPart}<span class="bracket">{...}</span> <span class="comment">// ${line.childCount} properties</span>`;
        } else if (line.isArray) {
          line.content = `${indent}${keyPart}<span class="bracket">[...]</span> <span class="comment">// ${line.childCount} items</span>`;
        }
      } else {
        // Restore original content
        const indent = '  '.repeat(line.level);
        const keyPart = line.originalKey ? `<span class="key">"${line.originalKey}"</span><span class="colon">: </span>` : '';
        
        if (line.isObject) {
          line.content = `${indent}${keyPart}<span class="bracket">{</span>`;
        } else if (line.isArray) {
          line.content = `${indent}${keyPart}<span class="bracket">[</span>`;
        }
      }
      
      this.updateDisplayLines();
    }
  }

  setActiveLine(index: number): void {
    this.activeLineIndex.set(index);
  }

  getToggleIcon(line: JsonLine): string {
    return line.isCollapsed ? '▶' : '▼';
  }

  toggleViewMode(): void {
    this.viewMode.set(this.viewMode() === 'formatted' ? 'textarea' : 'formatted');
  }

  getPlainTextContent(line: JsonLine): string {
    // Strip HTML tags to get plain text
    const div = document.createElement('div');
    div.innerHTML = line.content;
    return div.textContent || div.innerText || '';
  }

  onTextareaInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const content = textarea.value;
    this.textareaContent.set(content);
    
    // Try to parse and display if valid JSON
    if (content.trim()) {
      try {
        const jsonData = JSON.parse(content);
        this.rawJsonText.set(JSON.stringify(jsonData, null, 2));
        this.parseAndDisplay(jsonData);
        this.validationError.set('');
      } catch (error) {
        // Don't show error while typing, just keep textarea
        this.displayLines.set([]);
      }
    } else {
      this.displayLines.set([]);
    }
  }

  toggleEditMode(): void {
    if (!this.isEditMode()) {
      // Enter edit mode - parse into editable lines
      this.validationError.set('');
      this.hasUnsavedChanges.set(false);
      this.isValidJson.set(true);
      
      try {
        const jsonData = JSON.parse(this.rawJsonText());
        this.parseEditLines(jsonData);
      } catch (error) {
        this.editLines.set([]);
      }
      
      this.isEditMode.set(true);
    } else {
      // Check for unsaved changes
      if (this.hasUnsavedChanges()) {
        const confirmed = confirm('You have unsaved changes. Are you sure you want to exit without saving?');
        if (!confirmed) return;
      }
      
      // Exit edit mode without saving
      this.isEditMode.set(false);
      this.validationError.set('');
      this.hasUnsavedChanges.set(false);
      this.editLines.set([]);
      this.editAllLines = [];
    }
  }

  getEditableText(): string {
    // Only show visible (non-collapsed) lines
    const visibleLines = this.editAllLines.filter(line => {
      let parentId = line.parentId;
      while (parentId) {
        const parent = this.editAllLines.find(l => l.id === parentId);
        if (parent?.isCollapsed) return false;
        parentId = parent?.parentId || null;
      }
      return true;
    });
    return visibleLines.map(line => line.content).join('\n');
  }

  onEditTextareaChange(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.hasUnsavedChanges.set(true);
    
    // Don't update editAllLines during typing to avoid interference
    // Only validate on save
  }

  onEditKeyDown(event: KeyboardEvent): void {
    // Ctrl+S or Cmd+S to save
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      this.validateAndSave();
    }
  }

  onEditScroll(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const sidebar = document.querySelector('.edit-sidebar') as HTMLElement;
    if (sidebar) {
      sidebar.scrollTop = textarea.scrollTop;
    }
  }

  parseEditLines(data: any): void {
    this.editAllLines = [];
    let idCounter = 0;
    const generateId = () => `edit-${idCounter++}`;
    
    const parse = (value: any, key: string | null, level: number, parentId: string | null, isLastItem: boolean = false): void => {
      const currentId = generateId();
      const indent = '  '.repeat(level);
      const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
      const isArray = Array.isArray(value);
      
      if (isObject) {
        const keyPart = key !== null ? `"${key}": ` : '';
        const openBraceId = currentId;
        this.editAllLines.push({
          id: openBraceId,
          content: `${indent}${keyPart}{`,
          level,
          hasToggle: true,
          isCollapsed: false,
          parentId,
          lineNumber: 0,
          isClosing: false,
          originalKey: key,
          isArray: false,
          isObject: true,
          childCount: Object.keys(value).length
        });
        
        const entries = Object.entries(value);
        entries.forEach(([k, v], index) => {
          const isLast = index === entries.length - 1;
          parse(v, k, level + 1, openBraceId, isLast);
        });
        
        this.editAllLines.push({
          id: generateId(),
          content: `${indent}}${isLastItem ? '' : ','}`,
          level,
          hasToggle: false,
          isCollapsed: false,
          parentId: openBraceId,
          lineNumber: 0,
          isClosing: true,
          originalKey: null,
          isArray: false,
          isObject: false,
          childCount: 0
        });
      } else if (isArray) {
        const keyPart = key !== null ? `"${key}": ` : '';
        const openBracketId = currentId;
        this.editAllLines.push({
          id: openBracketId,
          content: `${indent}${keyPart}[`,
          level,
          hasToggle: true,
          isCollapsed: false,
          parentId,
          lineNumber: 0,
          isClosing: false,
          originalKey: key,
          isArray: true,
          isObject: false,
          childCount: value.length
        });
        
        value.forEach((item: any, index: number) => {
          const isLast = index === value.length - 1;
          parse(item, null, level + 1, openBracketId, isLast);
        });
        
        this.editAllLines.push({
          id: generateId(),
          content: `${indent}]${isLastItem ? '' : ','}`,
          level,
          hasToggle: false,
          isCollapsed: false,
          parentId: openBracketId,
          lineNumber: 0,
          isClosing: true,
          originalKey: null,
          isArray: false,
          isObject: false,
          childCount: 0
        });
      } else {
        const keyPart = key !== null ? `"${key}": ` : '';
        const valueStr = JSON.stringify(value);
        this.editAllLines.push({
          id: currentId,
          content: `${indent}${keyPart}${valueStr}${isLastItem ? '' : ','}`,
          level,
          hasToggle: false,
          isCollapsed: false,
          parentId,
          lineNumber: 0,
          isClosing: false,
          originalKey: key,
          isArray: false,
          isObject: false,
          childCount: 0
        });
      }
    };
    
    parse(data, null, 0, null, true);
    this.updateEditDisplayLines();
  }

  renumberEditLines(): void {
    let lineNum = 1;
    const visibleLines = this.editAllLines.filter(line => {
      let parentId = line.parentId;
      while (parentId) {
        const parent = this.editAllLines.find(l => l.id === parentId);
        if (parent?.isCollapsed) return false;
        parentId = parent?.parentId || null;
      }
      return true;
    });
    
    for (const line of visibleLines) {
      line.lineNumber = lineNum++;
    }
  }

  toggleEditCollapse(lineId: string): void {
    const line = this.editAllLines.find(l => l.id === lineId);
    if (!line || !line.hasToggle) return;

    // Toggle collapsed state
    line.isCollapsed = !line.isCollapsed;

    // Update the display
    this.updateEditDisplayLines();
  }

  onLineContentChange(lineId: string, event: Event): void {
    const element = event.target as HTMLElement;
    
    // Save cursor position
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    const cursorOffset = range?.startOffset || 0;
    const currentNode = range?.startContainer;
    
    const newContent = element.textContent || '';
    
    const line = this.editAllLines.find(l => l.id === lineId);
    if (line) {
      line.content = newContent;
      this.hasUnsavedChanges.set(true);
      
      // Restore cursor position after Angular updates
      setTimeout(() => {
        if (currentNode && element.contains(currentNode)) {
          const newRange = document.createRange();
          const newSelection = window.getSelection();
          
          try {
            newRange.setStart(currentNode, Math.min(cursorOffset, currentNode.textContent?.length || 0));
            newRange.collapse(true);
            newSelection?.removeAllRanges();
            newSelection?.addRange(newRange);
          } catch (e) {
            // If cursor position restore fails, place at end
            newRange.selectNodeContents(element);
            newRange.collapse(false);
            newSelection?.removeAllRanges();
            newSelection?.addRange(newRange);
          }
        }
      }, 0);
    }
  }

  onKeyDown(event: KeyboardEvent, lineId: string): void {
    // Ctrl+S or Cmd+S to save
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      this.validateAndSave();
    }
    
    // Tab key handling
    if (event.key === 'Tab') {
      event.preventDefault();
      const selection = window.getSelection();
      const range = selection?.getRangeAt(0);
      if (range) {
        const tabNode = document.createTextNode('  ');
        range.insertNode(tabNode);
        range.setStartAfter(tabNode);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }

  reconstructJsonFromEditLines(): string {
    return this.editAllLines.map(line => line.content).join('\n');
  }

  validateAndSave(): void {
    try {
      // Get JSON directly from textarea
      const textarea = document.querySelector('.edit-textarea') as HTMLTextAreaElement;
      const jsonText = textarea ? textarea.value : this.reconstructJsonFromEditLines();
      const jsonData = JSON.parse(jsonText);
      
      // Update the viewer with new data
      const formattedJson = JSON.stringify(jsonData, null, 2);
      this.rawJsonText.set(formattedJson);
      this.textareaContent.set(formattedJson);
      this.parseAndDisplay(jsonData);
      
      // Exit edit mode
      this.isEditMode.set(false);
      this.validationError.set('');
      this.hasUnsavedChanges.set(false);
      this.isValidJson.set(true);
      this.editLines.set([]);
      this.editAllLines = [];
      
      // Show success message
      this.successMessage.set('JSON validated and saved successfully!');
      setTimeout(() => this.successMessage.set(''), 3000);
    } catch (error) {
      // Show validation error
      if (error instanceof Error) {
        this.validationError.set(`Invalid JSON: ${error.message}`);
        this.isValidJson.set(false);
      } else {
        this.validationError.set('Invalid JSON format');
        this.isValidJson.set(false);
      }
    }
  }

  downloadJson(): void {
    const jsonText = this.rawJsonText();
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.fileName() || 'edited.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  formatJson(): void {
    try {
      const textarea = document.querySelector('.edit-textarea') as HTMLTextAreaElement;
      if (!textarea) return;
      
      const jsonData = JSON.parse(textarea.value);
      this.parseEditLines(jsonData);
      this.hasUnsavedChanges.set(true);
      this.validationError.set('');
      this.isValidJson.set(true);
    } catch (error) {
      if (error instanceof Error) {
        this.validationError.set(`Cannot format: ${error.message}`);
      }
    }
  }

  private updateEditDisplayLines(): void {
    const visibleLines: JsonLine[] = [];
    const collapsedParents = new Set<string>();
    
    this.editAllLines.forEach(line => {
      if (line.isCollapsed) {
        collapsedParents.add(line.id);
      }
    });
    
    for (const line of this.editAllLines) {
      let shouldShow = true;
      
      let currentParentId = line.parentId;
      while (currentParentId) {
        if (collapsedParents.has(currentParentId)) {
          shouldShow = false;
          break;
        }
        const parent = this.editAllLines.find(l => l.id === currentParentId);
        currentParentId = parent?.parentId || null;
      }
      
      if (shouldShow) {
        visibleLines.push(line);
      }
    }
    
    visibleLines.forEach((line, index) => {
      line.lineNumber = index + 1;
    });
    
    this.editLines.set(visibleLines);
  }



  private reconstructJsonFromLines(): string {
    const visibleLines = this.editAllLines.filter(line => {
      let shouldShow = true;
      let currentParentId = line.parentId;
      
      while (currentParentId) {
        const parent = this.editAllLines.find(l => l.id === currentParentId);
        if (parent?.isCollapsed) {
          shouldShow = false;
          break;
        }
        currentParentId = parent?.parentId || null;
      }
      
      return shouldShow;
    });
    
    return visibleLines.map(line => line.content).join('\n');
  }

  expandAll(): void {
    if (this.isEditMode()) {
      // Don't operate on editAllLines directly, just update the textarea
      const textarea = document.querySelector('.edit-textarea') as HTMLTextAreaElement;
      if (!textarea || !textarea.value.trim()) return; // Don't expand if textarea is empty
      
      this.editAllLines.forEach(line => {
        if (line.hasToggle && line.isCollapsed) {
          line.isCollapsed = false;
          const indent = '  '.repeat(line.level);
          const keyPart = line.originalKey ? `"${line.originalKey}": ` : '';
          if (line.isObject) {
            line.content = `${indent}${keyPart}{`;
          } else if (line.isArray) {
            line.content = `${indent}${keyPart}[`;
          }
        }
      });
      this.updateEditDisplayLines();
    } else {
      this.allLines.forEach(line => {
        if (line.hasToggle && line.isCollapsed) {
          line.isCollapsed = false;
          const indent = '  '.repeat(line.level);
          const keyPart = line.originalKey ? `<span class="key">"${line.originalKey}"</span><span class="colon">: </span>` : '';
          if (line.isObject) {
            line.content = `${indent}${keyPart}<span class="bracket">{</span>`;
          } else if (line.isArray) {
            line.content = `${indent}${keyPart}<span class="bracket">[</span>`;
          }
        }
      });
      this.updateDisplayLines();
    }
  }

  collapseAll(): void {
    if (this.isEditMode()) {
      // Don't operate on editAllLines directly, just update the textarea
      const textarea = document.querySelector('.edit-textarea') as HTMLTextAreaElement;
      if (!textarea || !textarea.value.trim()) return; // Don't collapse if textarea is empty
      
      this.editAllLines.forEach(line => {
        if (line.hasToggle && !line.isCollapsed) {
          line.isCollapsed = true;
          const indent = '  '.repeat(line.level);
          const keyPart = line.originalKey ? `"${line.originalKey}": ` : '';
          if (line.isObject) {
            line.content = `${indent}${keyPart}{...} // ${line.childCount} properties`;
          } else if (line.isArray) {
            line.content = `${indent}${keyPart}[...] // ${line.childCount} items`;
          }
        }
      });
      this.updateEditDisplayLines();
    } else {
      this.allLines.forEach(line => {
        if (line.hasToggle && !line.isCollapsed) {
          line.isCollapsed = true;
          const indent = '  '.repeat(line.level);
          const keyPart = line.originalKey ? `<span class="key">"${line.originalKey}"</span><span class="colon">: </span>` : '';
          if (line.isObject) {
            line.content = `${indent}${keyPart}<span class="bracket">{...}</span> <span class="comment">// ${line.childCount} properties</span>`;
          } else if (line.isArray) {
            line.content = `${indent}${keyPart}<span class="bracket">[...]</span> <span class="comment">// ${line.childCount} items</span>`;
          }
        }
      });
      this.updateDisplayLines();
    }
  }
}
