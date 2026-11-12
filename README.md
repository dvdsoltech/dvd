# DVDs

**Pair Splunk search macros with MCP tools.**

DVDs is a small admin tool that organizes query macros and exposes them as MCP tools. Each macro serves as the tool's SPL template, and the tool's properties map directly to the macro's variables. The LLM supplies arguments, and the query logic stays under your control.

## When to use it

- You want to organize queries as macros, including for use outside MCP contexts
- You want to constrain the LLM to predetermined searches
- You want to pass dynamic values through an MCP tool within the bounds of a macro
- You have many macros you'd like to map to MCP tools

## Background

While working on agentic orchestration projects, I often, or at least sometimes, knew exactly which query or lookup I wanted the agent to run and preferred in those cases for it to stick to what I had in mind. The built-in `splunk_run_query` tool was too open-ended, and being more explicit in the prompts wouldn't scale. I had started creating query catalogs that agents would reference to pass through the `splunk_run_query` tool but ran into complexities with passing in arguments.

Managing these queries as knowledge objects behind MCP tools seemed like the right approach, but mapping tool properties by hand was cumbersome, and less intuitive and flexible than working with standard Splunk knowledge objects. Macros, for example, can be reused well beyond the MCP use case.

Pairing a macro with an MCP tool turned out to be a useful and quick administrative workflow, so I built a tool for it.

## How it works

1. Enter the standard MCP tool attributes (name, title, description).
2. Enter a new macro name or select an existing one. Macro names use the `dvd_` prefix.
3. Define the properties to pass from the MCP tool to the macro.
4. Write the macro definition using those properties as variables (e.g., `$property_name$`).
5. Create the pair.

The app then produces an MCP tool whose SPL template is the associated macro, with properties that correspond to the macro's variables.

## Recommended convention

Macro and MCP tool names use the dvd_ prefix, which scopes these tools together and keeps them easy to find and separate from your other knowledge objects.

## Updates


## Screenshot.

### Form:
<img width="805" height="779" alt="start" src="https://github.com/user-attachments/assets/75c7745e-8d77-4bbb-b0b9-4f60a5b08643" />

### Example Filled-Out:
<img width="682" height="1234" alt="form_filled_in" src="https://github.com/user-attachments/assets/d2d5457f-f2d7-4b5a-9abf-d803b66ac995" />

### Macro Created
<img width="1088" height="52" alt="macro_created" src="https://github.com/user-attachments/assets/5c01b195-3219-4653-bc9c-7f56ff884061" />

### MCP Tool Created
<img width="821" height="712" alt="mcp_tool_created" src="https://github.com/user-attachments/assets/234e3d24-94f1-4bb4-a855-7ab55cba57a2" />

