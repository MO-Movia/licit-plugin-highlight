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

          // If document didn't change, return current state
          if (!tr.docChanged) {
            return state;
          }

          // Map decorations through the document changes
          let decorations = state.decorations.map(tr.mapping, tr.doc);

          // Only reprocess changed paragraphs
          if (state.searchTerm) {
            const changedRanges = LicitHighlightTextPlugin.getChangedRanges(tr);
            changedRanges.forEach((range) => {
              // Remove existing decorations in the changed range
              decorations = decorations.remove(
                decorations.find(range.from, range.to)
              );

              // Add new decorations only for the changed range
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

        // Find the containing textblock for the change
        tr.doc.nodesBetween(from, to, (node, pos) => {
          if (node.isTextblock) {
            from = pos;
            to = pos + node.nodeSize;
            return false; // Don't descend further
          }
          return true;
        });

        // Add a small buffer around the change
        ranges.push({
          from: Math.max(0, from),
          to: Math.min(tr.doc.content.size, to),
        });
      });
    });

    // Merge overlapping ranges
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

  static findHighlights(doc: Node, state: PluginState) {
    if (!state.searchTerm) return DecorationSet.empty;

    const decorations: Decoration[] = [];
    const searchTerm = state.searchTerm.replace(
      /[-/\\^$*+?.()|[\]{}]/g,
      '\\$&'
    );
    const regex = new RegExp(searchTerm, 'gi');

    let textContent = '';
    let textPositions: number[] = [];
    let selectedParaPositions = new Set<number>();
    let currentParaStart = 0;
    let nodeSize = 0;

    // First pass: collect text, positions, and find selected paragraphs
    doc.descendants((node, pos) => {
      if (node.attrs?.objectId === state.selectedHighlight) {
        selectedParaPositions.add(pos);
        nodeSize = node.nodeSize;
      }
      if (node.isText) {
        textContent += node.text;
        for (let i = 0; i < node.text.length; i++) {
          textPositions.push(pos + i);
        }
      }
      return true;
    });

    // Second pass: find matches and create decorations
    let match;
    while ((match = regex.exec(textContent)) !== null) {
      const from = textPositions[match.index];
      const to = textPositions[match.index + match[0].length - 1] + 1;

      if (from !== undefined && to !== undefined) {
        // Check if this match is within a selected paragraph
        const isInSelectedPara = Array.from(selectedParaPositions).some(
          (paraPos) => from >= paraPos && to <= paraPos + nodeSize
        );

        decorations.push(
          Decoration.inline(from, to, {
            class:
              isInSelectedPara && state.individualHighlightClass
                ? state.individualHighlightClass
                : state.highlightClass || '',
          })
        );
      }
    }

    return DecorationSet.create(doc, decorations);
  }

  static findHighlightsInRange(
    doc: Node,
    state: PluginState,
    range: { from: number; to: number }
  ) {
    if (!state.searchTerm) return [];

    const decorations: Decoration[] = [];
    const searchTerm = state.searchTerm.replace(
      /[-/\\^$*+?.()|[\]{}]/g,
      '\\$&'
    );
    const regex = new RegExp(searchTerm, 'gi');
    let selectedParaPositions = new Set<number>();
    let nodeSize = 0;

    // Find selected paragraphs in range
    doc.nodesBetween(range.from, range.to, (node, pos) => {
      if (node.attrs?.objectId === state.selectedHighlight) {
        selectedParaPositions.add(pos);
        nodeSize = node.nodeSize;
      }
      return true;
    });

    let textContent = '';
    let textPositions: number[] = [];

    // Collect text and positions within range
    doc.nodesBetween(range.from, range.to, (node, pos) => {
      if (node.isText) {
        textContent += node.text;
        for (let i = 0; i < node.text.length; i++) {
          textPositions.push(pos + i);
        }
      }
      return true;
    });

    // Find matches and create decorations
    let match;
    while ((match = regex.exec(textContent)) !== null) {
      const from = textPositions[match.index];
      const to = textPositions[match.index + match[0].length - 1] + 1;

      if (
        from !== undefined &&
        to !== undefined &&
        from >= range.from &&
        to <= range.to
      ) {
        // Check if this match is within a selected paragraph
        const isInSelectedPara = Array.from(selectedParaPositions).some(
          (paraPos) => from >= paraPos && to <= paraPos + nodeSize
        );

        decorations.push(
          Decoration.inline(from, to, {
            class:
              isInSelectedPara && state.individualHighlightClass
                ? state.individualHighlightClass
                : state.highlightClass || '',
          })
        );
      }
    }

    return decorations;
  }

  static updateSearchTerm(
    view: EditorView,
    searchTerm: string,
    HighlightDocProperties: HighlightDocProperties
  ) {
    const selectedId = HighlightDocProperties.selectedHighlight || '';
    const highlightClass = HighlightDocProperties.activeHighlightClass;
    const individualHighlightClass =
      HighlightDocProperties.individualHighlightClass;

    view.dispatch(
      view.state.tr.setMeta('search', {
        searchTerm,
        highlightClass,
        selectedHighlight: selectedId,
        individualHighlightClass,
      })
    );
  }
}

export default LicitHighlightTextPlugin;
