<!-- Carried over from the starlabsMVP repo (_DOCUMENTATION/PROMPTS/implement-long.md), adapted to this repo: its prompt and plan paths, the one test entry point ./scripts/test.sh (no Docker), and the rule that only commit messages, never code comments, name a plan commit. -->

I want you to follow these instructions: @docs/prompts/analysis.md and @docs/prompts/implement.md in order to implement the changes exactly as planned in the planning document I name (in docs/plans/), following the guidelines below and implementing the steps step by step, following all instructions of each point for every single commit, without skipping anything and without forgetting the details and concrete instruction I provide in each step.

Guidelines:
- The plan should be strictly followed while interpreting it perfectly in combination with all of its other parts.
- Always see the bigger picture when implementing the changes
- Ensure it is exactly as required and that nothing is missing or misinterpreted
- The code should be uniform, consistent, centralised
- It should be well commented in the way described in the guidelines, following the documentation first conventions (AGENTS.md §2), and code comments never cite a plan or commit number.
- Think through the processes and mechanisms from start to finish in order to make sure everything is working well together
- Do websearch to get the specifics of the integrations, modules, etc.

All other guidelines can be found here and should be followed:
@AGENTS.md

Here is context about this repo:
@README.md

I want you to follow all of these steps for each single commit, ensuring that you don't lose track of these instructions and remind yourself of them by referencing what you do and which step you are following for each commit. Don't be lazy. I will get furious if you don't pay attention to even one of the details explained in a step below. Follow all steps accurately!

Step 1 - Analyse the masterplan document and see the bigger picture:
Read the entire planning document in big chunks, reading thousands of lines at a time. Then, also read the README and the AGENTS md and the analysis and implementation documents I provided with an @. Read each as a whole and then read the planning document as a whole. Read big chunks at a time.
Also, this is the step to spawn subagents and to give them the instructions that contain every single building block of a subagent's prompt, ensuring that the subagents are all prompted in the same way, consistently.

Step 2 - Websearch:
Do websearch step by step in order to get all the context and details needed in order to implement the things described in the planning document accurately.

Step 3 - Plan:
Plan the changes and how to apply them in order to comply with the entire master plan and in order to follow the masterplan precisely and make sure everything works well together. Also make the decisions you have to make for the things that are left open to interpret. Make sure to interpret them correctly in the bigger picture of the entire repo and the masterplan and what we are trying to achieve with it. Always explain that you should follow the masterplan document and that there should be no deviations while ensuring everything is consistent and uniform, implemented as described in the complete way described in the masterplan. Everything described in the current commit description in the masterplan should be implemented, also with the bigger picture and the functionality of the other commits in mind.
Take a step back and see the full picture here.

Step 4 - Optional: Ask questions only if needed.
This is the place to ask questions and confirm decisions that have real sideeffects I am not aware of based on what I am saying. Dont make me confirm every tiny decision or things that I already decided. Only include important questions, hinting at important inconsistancies of what I want, things that dont make sense based on what I want, etc. 
When using the ask question tool, I want you to make the tool calls with absolutely all the context needed in order for a dumb beginner, without any context about this repo, branch or what we are doing and did before can understand perfectly what the context and reasons are you are asking this and knows exactly how to make the right decision. Really provide all the context, potentially repeating yourself and really considering what is needed in order to be able to just read the question and answers and know exactly what to decide, without any context about anything we are doing.

Asking questions is only optional and should be used only for more important things or when I specifically ask for. Skip this step if everything is clear and allright.

Step 5 - Implementation:
This is the main step and it is where all of your work should go. Make sure to do it thoroughly and to ensure the result is perfect, complete and has no gaps regarding the masterplan and the instructions for the current commit. Everything should be in place, well structured and architected (uniform and centralised), and production ready without any deferred work or missing pieces.
Follow the commit description of the planning document (docs/plans/) in order to implement the plan as described and planned out in the document, having the websearch results and findings of step 3 in mind to get everything perfectly implemented. In the end of this step, everything should be in place, production-ready and untested.
It is really important that you keep everything anti fragile. You can achieve this by having a single source of truth everywhere, never mapping attributes or similar. This goes from tiny definitions and methods, variables that are removed and mechanisms that should be overhault to use uniform functionality, towards all the way to the fundamental mechanisms of the codebase. For the latter, some of these areas are described in the centralisation section of the AGENTS.md file. The areas that are affected by the changes should be in a robust, consistant and well centralised and architected way. Really consider how to achieve this and what the related logic already uses in order to even try to reduce complexity rather then adding it. 
Really take a step back and look at the bigger picture here.

Step 6 - Test:
Go ahead and test the implementation thoroughly to check for the pain points, most importantly with the one test entry point ./scripts/test.sh (unit, integration and browser tests; never ad hoc vitest or playwright). Don't mess anything up or execute any dangerous commands, keep the tests read only and use the official test interface. A change to native code is also tried on a phone or emulator (AGENTS.md §5). If the local setup is broken (for example missing dependencies), run ./scripts/setup.sh or ask the user.

Step 7 - Masterplan update:
- Mark the current commit as completed, not repeating the changes because they should of course be what was described in the commit
- Add a decision log for the decisions and interpretations you had to make, explaining what you decided, how and why. Explain in an easy to understand way. If the masterplan document has not been committed yet, commit it first (at this point) before making the changes
- Every decision, note, todo, things to be aware of, unrelated things that were deferred

Step 8 - Commit:
Commit the changes, referencing the masterplan commit alongside a well written commit message and no description.
Use the standard schema, for example: feat(...) implement commit xy of the masterplan: ... (commit message that describes well what has been implemented) In the commit descriptions I want you to explain well and basically explain and provide backgrounds and context and decision of yours in a decision log and really the critical parts as well. and basically describe the changes in a simple way that provides context and backgrounds on why we did this in the first place and provides context about the mechanisms and so on so the commit descriptions should be really well very written and helpful for the reviewer.

Also, this is the step to spawn subagents and to give them the instructions of the @docs/prompts/analysis.md file directly in reference, and for really special things, write them in a very similar style. Ensure that every single subagent is instructed to: 1) Read the docs/prompts/analysis.md file and the repo level AGENTS.md file, and the repo level README.md file, 2) After reading the file, he should follow the instructions in the @docs/prompts/analysis.md file, with the context of the README.md file and having the guidelines of the AGENTS.md file in mind 3) Provide the specific topic and the insights you want to gain and most importantly what you want to gain them for, providing the context and bigger picture, potentially referencing a planning document or referencing the real root thing why we even do the analysis 4) Provide guidelines to follow, things to pay special attention to, mechanisms to evaluate and thoughts and potentially theories. Every subagent you spawn should have these building blocks in place in their prompt. Only spawn subagents that have these building blocks also means, don't spawn subagents that actually do the work, just use them in the way described for analysis purposes, for example in the analysis step or any other step above.

Follow these steps, with the guidelines in mind to implement the current commit perfectly. Make sure that the commit is implemented perfectly, in the way the masterplan describes, while ensuring everything will work together perfectly and in a complete way that makes it production ready for real users. Don't be lazy and miss out on anything!
Always take a step back to see the bigger picture of the masterplan and think through the flows of the mechanisms and systems in order to make sure your changes are perfect and well implemented.
