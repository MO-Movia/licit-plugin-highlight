import { Node } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';

export class LicitHighlightTextPlugin extends Plugin {

  constructor() {
    super({
        key: new PluginKey('LicitHighlightTextPlugin'),
      state: {
        init(_, { doc }) {
          return LicitHighlightTextPlugin.findHighlights(doc, '', '', '','');
        },
        apply(tr, oldState, newState) {
          if (!tr.docChanged && oldState === newState) {
            return oldState;
          }

          this.searchTerm = tr.getMeta('search')?.searchTerm;
          this.highlightClss = tr.getMeta('search')?.highlightClass;
          this.selectedHighlight = tr.getMeta('search')?.selectedHighlight;
          this.individualHighlightClass = tr.getMeta('search')?.individualHighlightClass;

          if (undefined === this.searchTerm) {
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

  static findHighlights(doc: Node, searchTerm: string, highlightClss: string, selectedHighlight?: string,individualHighlightClass?:string) {
    const decorations : Decoration[]=[];
    if (!searchTerm) return DecorationSet.empty;

    const regex = new RegExp(searchTerm, 'gi');
    const highlightedParagraphs = new Set<number>();
    let nodeSize:number;
    doc.descendants((node, pos) => {
      if (node.isText) {
         const appliedClass= highlightClss;
        this.highLight(regex,node,pos,decorations,appliedClass);
      }
    });
    if(selectedHighlight){

      doc.descendants((node, pos) => {
        // Check if node has the objectId that matches selectedHighlight
        if (node.attrs?.objectId === selectedHighlight) {
          highlightedParagraphs.add(pos);
          nodeSize = node.nodeSize;
        }
        if (node.isText) {
        highlightedParagraphs.forEach(highlightedPos => {
             if (pos >= highlightedPos && pos < highlightedPos + nodeSize) {
             const appliedClass = individualHighlightClass;
            this.highLight(regex,node,pos,decorations,appliedClass);
          }
        });
      }
      });
    }
    return DecorationSet.create(doc, decorations);
  }

  static highLight(regex:RegExp,node:Node,pos:number,decorations:Decoration[],appliedClass:string){
    let match;
    while ((match = regex.exec(node.text)) !== null) {
      const start = pos + match.index;
      const end = start + match[0].length;

      decorations.push(
        Decoration.inline(start, end, {
          class: appliedClass,
        })
      );
    }
  }

  static updateSearchTerm(view: EditorView, searchTerm: string, highlightClass: string, selectedHighlight?: string, individualHighlightClass?:string) {

   const selectedId = selectedHighlight || '';

    view.dispatch(
      view.state.tr.setMeta('search', {
        searchTerm,
        highlightClass,
        selectedHighlight: selectedId,
        individualHighlightClass:individualHighlightClass
      })
    );
  }
}
/**
* Export as default for backward compatibility.
*/
export default LicitHighlightTextPlugin;