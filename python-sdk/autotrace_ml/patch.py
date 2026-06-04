def patch_openai(client, openai_client):
    """Wrap openai_client.chat.completions.create so calls are traced automatically."""
    chat = openai_client.chat.completions
    original = chat.create
    if getattr(original, "_autotrace_patched", False):
        return openai_client

    def wrapped(*args, **kwargs):
        model = kwargs.get("model", "unknown")
        with client.llm(provider="openai", model=model, operation="chat") as span:
            resp = original(*args, **kwargs)
            usage = getattr(resp, "usage", None)
            if usage is not None:
                span.record(
                    prompt_tokens=getattr(usage, "prompt_tokens", None),
                    completion_tokens=getattr(usage, "completion_tokens", None),
                    total_tokens=getattr(usage, "total_tokens", None),
                )
            return resp

    wrapped._autotrace_patched = True
    chat.create = wrapped
    return openai_client


def patch_anthropic(client, anthropic_client):
    """Wrap anthropic_client.messages.create so calls are traced automatically."""
    messages = anthropic_client.messages
    original = messages.create
    if getattr(original, "_autotrace_patched", False):
        return anthropic_client

    def wrapped(*args, **kwargs):
        model = kwargs.get("model", "unknown")
        with client.llm(provider="anthropic", model=model, operation="chat") as span:
            resp = original(*args, **kwargs)
            usage = getattr(resp, "usage", None)
            if usage is not None:
                span.record(
                    prompt_tokens=getattr(usage, "input_tokens", None),
                    completion_tokens=getattr(usage, "output_tokens", None),
                )
            return resp

    wrapped._autotrace_patched = True
    messages.create = wrapped
    return anthropic_client
