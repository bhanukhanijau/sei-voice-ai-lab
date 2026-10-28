# Manual Vapi prompt correction

No saved Vapi assistant/tool configuration was changed. In the assistant's system prompt, replace the opening sentence under `ORDER NUMBERS` (the one that says to ask for digits separately) with exactly:

```text
Use a clearly provided three-digit order number immediately; do not ask for it again or require separate digits. Ask for the order number only when it is missing, uncertain, conflicting, or invalid. If the caller says “order 567”, call lookup_order with {"order_number":"567"} without asking them to repeat it.
```

Keep the existing normalization and ambiguity instructions that follow it. If the prompt's tool-routing instructions say to “collect” the order number, use “use the provided order number (ask only if missing or unclear)” instead. The app's Vapi Setup tab contains the updated full suggested prompt for reference; it is still copied manually.

The backend already accepts `"567"`, `"5 6 7"` and spoken equivalents. Its validation does not need changing. The tool descriptions already ask for repetition only when input is missing or unclear. The old local suggested system prompt was more prescriptive and can explain an unnecessary question if it was copied to Vapi. We cannot establish that this caused a particular recorded response without that call's raw events and the saved Vapi prompt. A visible browser transcript alone does not establish the exact model input or whether lookup_order was invoked. Check the affected call in Vapi: user message, tool arguments, tool result, and assistant prompt version. No private Vapi API credential or recording was supplied for this review.
