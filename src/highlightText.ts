import { Node } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';

export interface HighlightDocProperties {
  activeHighlightClass: string;
  selectedHighlight?: string;
  individualHighlightClass?: string;
}
const highlightDecorations = DecorationSet.empty;
export class LicitHighlightTextPlugin extends Plugin {

  constructor() {
    super({
        key: new PluginKey('LicitHighlightTextPlugin'),
      state: {
        init(_) {
          return highlightDecorations;
        },
        apply(tr, oldState, newState) {
          if (!tr.docChanged && oldState === newState ) {
            return oldState;
          }

          if (undefined !== tr.getMeta('search')?.searchTerm) {
            this.searchTerm = tr.getMeta('search')?.searchTerm;
            this.highlightClss = tr.getMeta('search')?.highlightClass;
            this.selectedHighlight = tr.getMeta('search')?.selectedHighlight;
            this.individualHighlightClass = tr.getMeta('search')?.individualHighlightClass;
          }
          else if (tr.getMeta('search')?.searchTerm === undefined && !tr.docChanged){
             return oldState;
          }
          return {
            ...oldState,
            decorations: LicitHighlightTextPlugin.findHighlights(
              tr.doc,
              this.searchTerm,
              this.highlightClss,
              this.selectedHighlight,
              this.individualHighlightClass
            ),
          };
        },
      },
      props: {
        decorations(state) {
          return this.getState(state).decorations;
        },
      },
    });
  }

  static findHighlights(
    doc: Node,
    searchTerm: string,
    highlightClss: string,
    selectedHighlight?: string,
    individualHighlightClass?: string
  ) {
    const decorations: Decoration[] = [];
    if (!searchTerm) return DecorationSet.empty;
    const regex = new RegExp(searchTerm, 'gi');
    const highlightedParagraphs = new Set<number>();
    let nodeSize: number;
    let mergedText = '';
    let nodePositions: { pos: number; length: number }[] = [];
    doc.descendants((node, pos) => {
      if (node.isText) {
        nodePositions.push({ pos, length: node.text.length });
        mergedText += node.text;
      } else if (mergedText) {
          this.highLight(regex, mergedText, nodePositions, decorations, highlightClss);
          mergedText = '';
          nodePositions = [];
        }
    });
    if (mergedText) {
      this.highLight(regex, mergedText, nodePositions, decorations, highlightClss);
    }
    if (selectedHighlight) {
      mergedText = '';
      nodePositions = [];
      doc.descendants((node, pos) => {
        if (node.attrs?.objectId === selectedHighlight) {
          highlightedParagraphs.add(pos);
          nodeSize = node.nodeSize;
        }
        if (node.isText) {
          nodePositions.push({ pos, length: node.text.length });
          mergedText += node.text;
        } else if (mergedText) {
            highlightedParagraphs.forEach(highlightedPos => {
              if (nodePositions.some(({ pos }) => pos >= highlightedPos && pos < highlightedPos + nodeSize)) {
                this.highLight(regex, mergedText, nodePositions, decorations, individualHighlightClass);
              }
            });
            mergedText = '';
            nodePositions = [];
          }
      });
      if (mergedText) {
        highlightedParagraphs.forEach(highlightedPos => {
          if (nodePositions.some(({ pos }) => pos >= highlightedPos && pos < highlightedPos + nodeSize)) {
            this.highLight(regex, mergedText, nodePositions, decorations, individualHighlightClass);
          }
        });
      }
    }
    return DecorationSet.create(doc, decorations);
  }
  // Function to handle highlighting across multiple text nodes
  static highLight(
    regex: RegExp,
    mergedText: string,
    nodePositions: { pos: number; length: number }[],
    decorations: Decoration[],
    appliedClass: string
  ) {
    let match;
    while ((match = regex.exec(mergedText)) !== null) {
      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;
      let currentOffset = 0;
      for (const { pos, length } of nodePositions) {
        const nodeStart = currentOffset;
        const nodeEnd = nodeStart + length;
        if (startOffset < nodeEnd && endOffset > nodeStart) {
          const start = Math.max(pos, pos + startOffset - nodeStart);
          const end = Math.min(pos + length, pos + endOffset - nodeStart);
          decorations.push(Decoration.inline(start, end, { class: appliedClass }));
        }
        currentOffset += length;
      }
    }
  }

  static updateSearchTerm(view: EditorView, searchTerm: string, HighlightDocProperties :HighlightDocProperties) {

   const selectedId = HighlightDocProperties.selectedHighlight || '';
   const highlightClass = HighlightDocProperties.activeHighlightClass;
   const individualHighlightClass = HighlightDocProperties.individualHighlightClass;

    view.dispatch(
      view.state.tr.setMeta('search', {
        searchTerm,
        highlightClass,
        selectedHighlight: selectedId,
        individualHighlightClass
      })
    );
  }
}
/**
* Export as default for backward compatibility.
*/
export default LicitHighlightTextPlugin;