import { LicitHighlightTextPlugin } from './highlightText';
import { EditorView } from 'prosemirror-view';
import { EditorState, EditorStateConfig, Transaction } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
const writeText = jest.fn();

Object.assign(navigator, {
  clipboard: {
    writeText,
  },
});
describe('LicitHighlightTextPlugin', () => {
  jest.mock('prosemirror-model', () => {
    const originalModule = jest.requireActual('prosemirror-model');
    beforeAll(() => {
      navigator.clipboard.writeText('copy');
    });

    return {
      ...originalModule,
      DOMParser: {
        fromSchema: jest.fn(() => ({
          parse: jest.fn(),
        })),
      },
    };
  });
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});

  beforeEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });
  beforeEach(() => {
    const createElement = document.createElement.bind(document);
    document.createElement = (tagName) => {
      if (tagName === 'canvas') {
        return {
          getContext: () => ({}),
          measureText: () => ({}),
        };
      }
      return createElement(tagName);
    };
  });
  const plugin = new LicitHighlightTextPlugin();
  const mySchema = new Schema({
    nodes: {
      doc: { content: 'paragraph+' },
      paragraph: {
        content: 'inline*',
        group: 'block',
        attrs: { objectId: { default: null } }, // Define the attribute
        parseDOM: [{ tag: 'p', getAttrs: dom => ({ objectId: dom.getAttribute('data-objectid') }) }],
        toDOM: node => ['p', { 'data-objectid': node.attrs.objectiId }, 0]
      },
      text: { group: 'inline' }
    }
  });
  const docJson = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { objectId: 'modusoperandi' }, // Custom attribute
        content: [
          {
            type: 'text',
            text: 'This is a dummy text node in ProseMirror.'
          }
        ]
      },
      {
        type: 'paragraph',
        attrs: { objectId: 'modusoperandi' }, // Custom attribute
        content: [
          {
            type: 'text',
            text: 'This is a dummy text node in ProseMirror.'
          }
        ]
      }
    ]};
    const docNode = mySchema.nodeFromJSON(docJson);

  it('should be defined',  () => {
    expect(plugin).toBeDefined();
  });

  it('should handle init',()=>{
    expect(plugin.spec.state?.init(null as unknown as EditorStateConfig,{docNode} as unknown as EditorState)).toBeDefined();
  });
  it('should handle init',()=>{
    expect(plugin.spec.state?.init(null as unknown as EditorStateConfig,{docNode} as unknown as EditorState)).toBeDefined();
  });

  it('should handle apply',()=>{
    expect(plugin.spec.state?.apply({doc:docNode,docChanged:false,getMeta:()=>{return {searchTerm:'searchTerm',highlightClass:'match-highlight',selectedHighlight:'modusoperandi'};}} as unknown as Transaction,{},{} as unknown as EditorState,{} as unknown as EditorState)).toBeDefined();
  });
  it('should handle apply without searchterm',()=>{
    expect(plugin.spec.state?.apply({doc:docNode,docChanged:false,getMeta:()=>{return {searchTerm:'',highlightClass:'match-highlight',selectedHighlight:'modusoperandi'};}} as unknown as Transaction,{},{} as unknown as EditorState,{} as unknown as EditorState)).toBeDefined();
  });
  it('should handle apply without selectedhighlight',()=>{
    expect(plugin.spec.state?.apply({doc:docNode,docChanged:false,getMeta:()=>{return {searchTerm:'searchTerm',highlightClass:'match-highlight',selectedHighlight:''};}} as unknown as Transaction,{},{} as unknown as EditorState,{} as unknown as EditorState)).toBeDefined();
  });

  it('should handle apply when undefined is searchterm',()=>{
    expect(plugin.spec.state?.apply({doc:docNode,docChanged:false,getMeta:()=>{return {searchTerm:undefined,highlightClass:'match-highlight',selectedHighlight:'modusoperandi'};}} as unknown as Transaction,'',{} as unknown as EditorState,{} as unknown as EditorState)).toBeDefined();
  });



  it('should handle updateSearchTerm',()=>{
    const HighlightDocProperties= {
      activeHighlightClass: 'match-highlight',
      selectedHighlight: 'paragrapghId',
      individualHighlightClass: 'individual-highlight',
    };
    expect(LicitHighlightTextPlugin.updateSearchTerm({dispatch:()=>{},state:{tr:{setMeta:()=>{}}}} as unknown as EditorView,'test',HighlightDocProperties)).toBeUndefined();
  });

  it('should handle updateSearchTerm when there is no selected id',()=>{
    expect(LicitHighlightTextPlugin.updateSearchTerm({dispatch:()=>{},state:{tr:{setMeta:()=>{}}}} as unknown as EditorView,'test',{
      activeHighlightClass: ''
    })).toBeUndefined();
  });
  it('should handle apply when undefined is searchterm', () => {
    const pluginInstance = plugin as Plugin<any>;
    pluginInstance.getState = ()=>{return {};};
    const boundDecorations = pluginInstance.spec.props?.decorations?.bind(pluginInstance);
    expect(boundDecorations?.({} as unknown as EditorState)).toBeUndefined();
  });
});
