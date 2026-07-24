#
#  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#

import sys
from functools import partial

from lxml import etree

_configured = False


def _xml_parser(*, remove_blank_text: bool = False, element_class_lookup=None):
    parser = etree.XMLParser(
        huge_tree=True,
        remove_blank_text=remove_blank_text,
        resolve_entities=False,
        no_network=True,
    )
    if element_class_lookup is not None:
        parser.set_element_class_lookup(element_class_lookup)
    return parser


def _configure_openpyxl():
    from openpyxl.xml import functions

    previous_fromstring = functions.fromstring
    parser = _xml_parser()
    large_fromstring = partial(etree.fromstring, parser=parser)

    functions.safe_parser = parser
    functions.fromstring = large_fromstring

    # openpyxl imports fromstring into its reader modules. Replace those
    # already-imported aliases as well; modules imported later receive the
    # updated function directly from openpyxl.xml.functions.
    for module_name, module in tuple(sys.modules.items()):
        if not module_name.startswith("openpyxl.") or module is None:
            continue
        if getattr(module, "fromstring", None) is previous_fromstring:
            module.fromstring = large_fromstring


def _configure_python_docx():
    from docx.oxml import parser as docx_parser

    docx_parser.oxml_parser = _xml_parser(
        remove_blank_text=True,
        element_class_lookup=docx_parser.element_class_lookup,
    )


def _configure_python_pptx():
    import pptx.oxml as pptx_oxml

    pptx_oxml.oxml_parser = _xml_parser(
        remove_blank_text=True,
        element_class_lookup=pptx_oxml.element_class_lookup,
    )


def configure_large_ooxml_parsers():
    """Allow large Office XML parts while keeping entity expansion disabled."""

    global _configured
    if _configured:
        return

    _configure_openpyxl()
    _configure_python_docx()
    _configure_python_pptx()
    _configured = True
