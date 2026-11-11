# DVDs
While working on some agentic orchestration projects, there were times that I knew precisely the query or lookup I wanted the agent to reference. The built-in splunk_run_query tool was a bit too open-ended and I knew being more explicit in the prompts wouldn't scale well. Organizing these queries as knowledge objects within the MCP tools seemed doable though mapping tool properties wasn't as strict as I would have liked and less intuitive than managing the typical Splunk knowledge objects.

Marrying the Macro to an MCP tool appeared as a potential solution. 

1. Enter the typical MCP tool attributes (name, title, etc.)
2. Enter a macro name or select a predefined macro (note the naming convention)
3. Enter the properties (arguments) to be passed from MCP to Macro
4. Finish with the macro definition using the added properties 

The tool zips these together producing an MCP tool with the associated macro as its SPL template and properties that correspond with the macro variables. 

Of course, you could do this all manually...

As with anything in tech these days, it's hard to tell what might be useful and for how long it will be useful. Hope this makes some admin's day just a little lighter. 
