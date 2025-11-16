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
        this.rawJsonText.set(JSON.stringify(jsonData, null, 2));
        this.parseAndDisplay(jsonData);
      } catch (error) {
        alert('Invalid JSON file. Please upload a valid JSON file.');
        this.displayLines.set([]);
        this.rawJsonText.set('');
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

  toggleEditMode(): void {
    if (!this.isEditMode()) {
      // Enter edit mode
      this.editedText.set(this.rawJsonText());
      this.validationError.set('');
      this.isEditMode.set(true);
      this.viewMode.set('textarea'); // Switch to textarea for editing
    } else {
      // Exit edit mode without saving
      this.isEditMode.set(false);
      this.validationError.set('');
    }
  }

  onTextChange(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.editedText.set(textarea.value);
    this.validationError.set(''); // Clear error on change
  }

  validateAndSave(): void {
    const text = this.editedText();
    
    try {
      // Validate JSON
      const jsonData = JSON.parse(text);
      
      // Update the viewer with new data
      this.rawJsonText.set(JSON.stringify(jsonData, null, 2));
      this.parseAndDisplay(jsonData);
      
      // Exit edit mode
      this.isEditMode.set(false);
      this.validationError.set('');
      
      // Show success message
      alert('✓ JSON is valid and saved successfully!');
    } catch (error) {
      // Show validation error
      if (error instanceof Error) {
        this.validationError.set(`Invalid JSON: ${error.message}`);
      } else {
        this.validationError.set('Invalid JSON format');
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
}
