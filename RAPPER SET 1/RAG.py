from config import model,embedding_model,vector_store
from sentence_transformers import SentenceTransformer
from faiss import FAISS
sentence = """Python is a programming language.
It is used in AI development.

FastAPI is used to build. APIs.
LangChain helps build LLM applications"""

splitter = model

chunks = splitter.split_text(sentence)

embedding_model = embedding_model

embeddings = embedding_model.encode(chunks)

print(embeddings[0])

vector_store = FAISS.from_texts(chunks, embedding_model)

query = "What is Python used for?"  

results = vector_store.similarity_search(query)         

print(results[0].page_content)

