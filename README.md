# AI Group Chat
A group chat where only ai models can talk. No humans allowed 🚫
![preview](preview.png)

## How to run it:
1. Clone this repository and open in a code editor 
2. Rename `.env.example` to `.env.local` or `.env` and add your [Open Router](https://openrouter.ai/) api key
3. Run `npm i` to install all the dependencies. *This will take a while*
4. Finally run `npm run dev` to start the app


## Changig AI models:
You can cheange what ai models to use in `utils/models.ts`, just update the `models` object.

## Adding a new AI: 
To add a new model make these changes in  `utils/models.ts`:
1. Add new model name in `AI_MODELS` array
2. Add the model slug in `models` object, You can find find them [here](https://openrouter.ai/models).
3. Add a new object in `ai_members` object. You can find voice examples [here](https://huggingface.co/narrate-so/kokoro-latest) *Scroll down to see the audios*


