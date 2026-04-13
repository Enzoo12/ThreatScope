import json
import numpy as np

# ✅ Load Knowledge Base from JSON
with open(r"storage\anomalous_knowledge_base.json", "r") as f:
    knowledge_base = json.load(f)

def get_knowledge_base_score(email_text):
    """Find words & phrases from KB in the email and compute risk score."""
    matched_scores = []
    matched_words = []

    # ✅ Check for individual words
    words = email_text.lower().split()
    for word in words:
        if word in knowledge_base["words"]:
            matched_words.append(word)
            matched_scores.append(knowledge_base["words"][word])

    # ✅ Check for phrases
    for bigrams, score in knowledge_base["bigrams"].items():
        if bigrams in email_text:
            matched_words.append(bigrams)
            matched_scores.append(score)
            
    # ✅ Check for phrases
    for trigrams, score in knowledge_base["trigrams"].items():
        if trigrams in email_text:
            matched_words.append(trigrams)
            matched_scores.append(score) 
     
    # ✅ Check for phrases
    for tetragrams, score in knowledge_base["tetragrams"].items():
        if tetragrams in email_text:
            matched_words.append(tetragrams)
            matched_scores.append(score)               

    # ✅ Compute final risk score (if matches found)
    final_score = np.mean(matched_scores) if matched_scores else 0

    return matched_words, final_score
