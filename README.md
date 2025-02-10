

# LicitHighlightText Plugin For Licit

Plugin allows to highlight text in licit.  

## Build  

### Commands
- npm install
- npm pack  

#### To use this in Licit

- npm install *mo-licit-highlight-text-0.1.0.tgz*

####  To include plugin in Licit Component 

- import LicitHighlightTextPlugin 

- add LicitHighlightTextPlugin instance in licit's plugin array

```
import LicitHighlightTextPlugin from '@mo/licit-highlight-text';  
const plugins = [new LicitHighlightTextPlugin()]

ReactDOM.render(<Licit docID={0} plugins={plugins}/>)
```
#### How to use this plugin in Licit Editor
This plugin scans the editor content for occurrences of a given search term and applies background and text styling to highlight matching words dynamically.

Search term is updated dynamically.

Matches are highlighted in grey colour & selected matches are highlighted in orange colour.

Supports case-insensitive searches.


 