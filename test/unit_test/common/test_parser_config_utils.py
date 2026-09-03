from common.parser_config_utils import resolve_parser_model_reference


def test_resolve_parser_model_reference_maps_tenant_model_id_to_mineru():
    model_id = "ac693a468cb711f1a099b70e6206f363"
    calls = []

    def resolve(reference):
        calls.append(reference)
        return "mineru-model@default@MinerU"

    assert resolve_parser_model_reference(model_id, resolve) == (
        "MinerU",
        "mineru-model@default@MinerU",
    )
    assert calls == [model_id]


def test_resolve_parser_model_reference_skips_builtin_parser_name():
    calls = []

    assert resolve_parser_model_reference("MinerU", calls.append) == (
        "MinerU",
        None,
    )
    assert calls == []
