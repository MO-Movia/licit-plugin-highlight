import { Node } from 'prosemirror-model';
import { Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';

export interface HighlightDocProperties {
  activeHighlightClass: string;
  selectedHighlight?: string;
  individualHighlightClass?: string;
}

export interface PluginState {
  decorations: DecorationSet;
  searchTerm?: string;
  highlightClass?: string;
  selectedHighlight?: string;
  individualHighlightClass?: string;
}

export class LicitHighlightTextPlugin extends Plugin<PluginState> {
  constructor() {
    super({
      key: new PluginKey('LicitHighlightTextPlugin'),
      state: {
        init(): PluginState {
          return {
            decorations: DecorationSet.empty,
          };
        },
        apply(tr: Transaction, state: PluginState): PluginState {
          const searchMeta = tr.getMeta('search');
          if (searchMeta) {
            const newState = {
              ...state,
              searchTerm: searchMeta.searchTerm,
              highlightClass: searchMeta.highlightClass,
              selectedHighlight: searchMeta.selectedHighlight,
              individualHighlightClass: searchMeta.individualHighlightClass,
            };

            return {
              ...newState,
              decorations: LicitHighlightTextPlugin.findHighlights(
                tr.doc,
                newState
              ),
            };
          }

          if (!tr.docChanged) {
            return state;
          }

          let decorations = state.decorations.map(tr.mapping, tr.doc);

          if (state.searchTerm) {
            const changedRanges = LicitHighlightTextPlugin.getChangedRanges(tr);
            changedRanges.forEach((range) => {
              decorations = decorations.remove(
                decorations.find(range.from, range.to)
              );

              const newDecorations =
                LicitHighlightTextPlugin.findHighlightsInRange(
                  tr.doc,
                  state,
                  range
                );

              decorations = decorations.add(tr.doc, newDecorations);
            });
          }

          return {
            ...state,
            decorations,
          };
        },
      },
      props: {
        decorations(state) {
          return this.getState(state)?.decorations;
        },
      },
    });
  }

  static getChangedRanges(tr: Transaction) {
    const ranges: { from: number; to: number }[] = [];

    tr.steps?.forEach((step, i) => {
      const map = tr.mapping.maps[i];
      map.forEach((oldStart, oldEnd, newStart, newEnd) => {
        let from = newStart;
        let to = newEnd;

        tr.doc.nodesBetween(from, to, (node, pos) => {
          if (node.isTextblock) {
            from = pos;
            to = pos + node.nodeSize;
            return false;
          }
          return true;
        });

        ranges.push({
          from: Math.max(0, from),
          to: Math.min(tr.doc.content.size, to),
        });
      });
    });

    return ranges.reduce((merged, current) => {
      const prev = merged[merged.length - 1];
      if (prev && current.from <= prev.to) {
        prev.to = Math.max(prev.to, current.to);
      } else {
        merged.push(current);
      }
      return merged;
    }, [] as { from: number; to: number }[]);
  }

  static createSearchRegex(searchTerm: string): RegExp {
    const escapedTerm = searchTerm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    return new RegExp(escapedTerm, 'gi');
  }

  static findHighlights(doc: Node, state: PluginState) {
    if (!state.searchTerm?.trim()) return DecorationSet.empty;
    const decorations: Decoration[] = [];
    const regex = this.createSearchRegex(state.searchTerm);
    const selectedParaPositions = new Set<number>();
    let selectedNodeSize = 0;

    if (state.selectedHighlight) {
      doc.descendants((node, pos) => {
        if (node.attrs?.objectId === state.selectedHighlight) {
          selectedParaPositions.add(pos);
          selectedNodeSize = node.nodeSize;
        }
        return true;
      });
    }

    doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        const text = node.text;

        regex.lastIndex = 0;

        let match;
        while ((match = regex.exec(text)) !== null) {
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
            continue;
          }

          const from = pos + match.index;
          const to = from + match[0].length;

          if (match[0].includes('\n')) {
            continue;
          }

          const isInSelectedPara = Array.from(selectedParaPositions).some(
            (paraPos) => from >= paraPos && to <= paraPos + selectedNodeSize
          );

          const highlightClass =
            isInSelectedPara && state.individualHighlightClass
              ? state.individualHighlightClass
              : state.highlightClass || '';

          decorations.push(
            Decoration.inline(from, to, {
              class: highlightClass,
            })
          );
        }
      }
      return true;
    });

    return DecorationSet.create(doc, decorations);
  }

  static findHighlightsInRange(
    doc: Node,
    state: PluginState,
    range: { from: number; to: number }
  ) {
    if (!state.searchTerm?.trim()) return [];
    const decorations: Decoration[] = [];
    const regex = this.createSearchRegex(state.searchTerm);

    const { selectedParaPositions, selectedNodeSize } =
      this.getSelectedParagraphs(doc, state, range);
    const context = {
      range,
      selectedParaPositions,
      selectedNodeSize,
      state,
      decorations,
    };

    doc.nodesBetween(range.from, range.to, (node, pos) => {
      if (node.isText && node.text) {
        this.processTextMatches(node.text, regex, pos, context);
      }
      return true;
    });

    return decorations;
  }

  private static getSelectedParagraphs(
    doc: Node,
    state: PluginState,
    range: { from: number; to: number }
  ) {
    const selectedParaPositions = new Set<number>();
    let selectedNodeSize = 0;

    if (state.selectedHighlight) {
      doc.nodesBetween(range.from, range.to, (node, pos) => {
        if (node.attrs?.objectId === state.selectedHighlight) {
          selectedParaPositions.add(pos);
          selectedNodeSize = node.nodeSize;
        }
        return true;
      });
    }

    return { selectedParaPositions, selectedNodeSize };
  }

  static processTextMatches(
    text: string,
    regex: RegExp,
    pos: number,
    context: {
      range: { from: number; to: number };
      selectedParaPositions: Set<number>;
      selectedNodeSize: number;
      state: PluginState;
      decorations: Decoration[];
    }
  ) {
    regex.lastIndex = 0;

    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index === regex.lastIndex) {
        regex.lastIndex++; // Prevent infinite loops
        continue;
      }

      const from = pos + match.index;
      const to = from + match[0].length;

      if (match[0].includes('\n')) {
        continue;
      }

      if (from >= context.range.from && to <= context.range.to) {
        const isInSelectedPara = Array.from(context.selectedParaPositions).some(
          (paraPos) =>
            from >= paraPos && to <= paraPos + context.selectedNodeSize
        );

        const highlightClass =
          isInSelectedPara && context.state.individualHighlightClass
            ? context.state.individualHighlightClass
            : context.state.highlightClass || '';

        context.decorations.push(
          Decoration.inline(from, to, { class: highlightClass })
        );
      }
    }
  }

  static updateSearchTerm(
    view: EditorView,
    searchTerm: string,
    HighlightDocProperties: HighlightDocProperties
  ) {
    const selectedId = HighlightDocProperties.selectedHighlight || '';

    view.dispatch(
      view.state.tr.setMeta('search', {
        searchTerm,
        highlightClass: HighlightDocProperties.activeHighlightClass,
        selectedHighlight: selectedId,
        individualHighlightClass:
          HighlightDocProperties.individualHighlightClass,
      })
    );
  }
}

export default LicitHighlightTextPlugin;
