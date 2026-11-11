# DVDs
Simply a tool to organize query macros with MCP tools. Macros serve as a query constraint in the MCP's SPL Template while having the properties align with macro variables. 

Use this simple tool if you have the following requirements
- You want to organize queries under macros (use outside of MCP tool contexts)
- Constrain the LLM to pre-determined searches
- Serve dynamic values within the constraints of a macro through an MCP tool.
- You have a lot of macros you want mapped to MCP tools

While working on some agentic orchestration projects, there were times that I knew precisely the query or lookup I wanted the agent to reference. The built-in splunk_run_query tool was a bit too open-ended and I knew being more explicit in the prompts wouldn't scale well. Organizing these queries as knowledge objects within the MCP tools seemed doable though mapping tool properties wasn't as strict as I would have liked and less intuitive and flexible than managing the typical Splunk knowledge objects (I can reuse macros outside of the MCP use case context).

Marrying the Macro to an MCP tool quickly and efficiently presented itself as useful administrative tool. 

1. Enter the typical MCP tool attributes 
2. Enter a macro name or select a predefined macro (note the naming convention)
3. Enter the properties to be passed from MCP to Macro
4. Finish with the macro definition using the added properties
5. Create the pair. 

The tool zips these together producing an MCP tool with the associated macro as its SPL template and properties that correspond with the macro variables. 

Of course, you could do this all manually...
Or until Splunk roles out something out native :)
