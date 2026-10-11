"""en / hi / mr strings for the report email (plan_backend.txt 6.9).

KEEP IN SYNC with plan_frontend.txt section 6 (report sentence templates). If M changes the
wording there, change it here in the same PR. Neutral language only: the neutral-word test
covers this file. Hindi and Marathi are a first draft and need a native-speaker review."""

LANGS = ("en", "hi", "mr")

MONTHS = {
    "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    "hi": ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर",
           "अक्टूबर", "नवंबर", "दिसंबर"],
    "mr": ["जानेवारी", "फेब्रुवारी", "मार्च", "एप्रिल", "मे", "जून", "जुलै", "ऑगस्ट",
           "सप्टेंबर", "ऑक्टोबर", "नोव्हेंबर", "डिसेंबर"],
}

STRINGS = {
    "en": {
        "subject": "Your RationSaathi report: {period}",
        "greeting": "Hello,",
        "intro": "Here is the report you asked for, covering {period}.",
        "expected": "Expected", "received": "Received (confirmed)",
        "remaining": "Remaining", "difference": "Difference",
        "open_report": "Open full report",
        "link_note": "Anyone with this link can view the report.",
        "sentence_shortfall": (
            "Confirmed records for {item} total {received} {unit} against an expected "
            "entitlement of {expected} {unit} for {period}, a difference of {diff} {unit}. "
            "The reason for this difference has not been established."),
        "sentence_no_difference": (
            "Confirmed records for {item} total {received} {unit}, which matches the expected "
            "entitlement of {expected} {unit} for {period}."),
        "sentence_above_expected": (
            "Confirmed records for {item} total {received} {unit}, which is {diff} {unit} "
            "more than the expected entitlement of {expected} {unit} for {period}."),
        "sentence_ongoing": (
            "So far, confirmed records for {item} total {received} {unit} of an expected "
            "{expected} {unit}. The period ends on {end}, so this may change."),
        "balance_ongoing": (
            "{remaining} {unit} of your {expected} {unit} for {item} is still to be collected "
            "this period ({percent}% recorded so far)."),
        "balance_ended": (
            "{remaining} {unit} of the {expected} {unit} entitlement for {item} was not "
            "recorded as collected in this period. This does not say why."),
        "balance_full": "The full {expected} {unit} for {item} has been recorded.",
        "balance_over": "{over_by} {unit} more than the entitlement has been recorded for {item}.",
        "note_excluded": (
            "{n} record(s) for {item} were not included in the total. "
            "Open the full report for details."),
        "note_unmatched": (
            "{n} record(s) had no entitlement rule entered, so they were not compared."),
        "carry_note": (
            "Whether unused ration can be collected later depends on the scheme's own rules, "
            "which this tool does not assume. Please check with your local office."),
        "report_footer": (
            "This report compares recorded quantities with the rules you entered. It does "
            "not establish the cause of any difference."),
        "email_footer": (
            "You received this because a RationSaathi report was requested from your account. "
            "RationSaathi is an independent tool and is not a government service."),
    },
    "hi": {
        "subject": "आपकी RationSaathi रिपोर्ट: {period}",
        "greeting": "नमस्ते,",
        "intro": "आपकी मांगी हुई रिपोर्ट यह रही, अवधि: {period}।",
        "expected": "अपेक्षित", "received": "प्राप्त (पुष्टि किए गए)",
        "remaining": "बाकी", "difference": "अंतर",
        "open_report": "पूरी रिपोर्ट खोलें",
        "link_note": "इस लिंक वाला कोई भी व्यक्ति रिपोर्ट देख सकता है।",
        "sentence_shortfall": (
            "{item} के पुष्टि किए गए रिकॉर्ड का कुल {received} {unit} है, जबकि {period} के लिए "
            "अपेक्षित पात्रता {expected} {unit} है; अंतर {diff} {unit} का है। "
            "इस अंतर का कारण निर्धारित नहीं हुआ है।"),
        "sentence_no_difference": (
            "{item} के पुष्टि किए गए रिकॉर्ड का कुल {received} {unit} है, जो {period} के लिए "
            "अपेक्षित पात्रता {expected} {unit} के बराबर है।"),
        "sentence_above_expected": (
            "{item} के पुष्टि किए गए रिकॉर्ड का कुल {received} {unit} है, जो {period} के लिए "
            "अपेक्षित पात्रता {expected} {unit} से {diff} {unit} अधिक है।"),
        "sentence_ongoing": (
            "अब तक {item} के पुष्टि किए गए रिकॉर्ड का कुल {received} {unit} है, "
            "अपेक्षित {expected} {unit} में से। अवधि {end} को समाप्त होगी, इसलिए यह बदल सकता है।"),
        "balance_ongoing": (
            "{item} के आपके {expected} {unit} में से {remaining} {unit} इस अवधि में अभी लेना "
            "बाकी है (अब तक {percent}% दर्ज)।"),
        "balance_ended": (
            "{item} की {expected} {unit} पात्रता में से {remaining} {unit} इस अवधि में लिया "
            "गया दर्ज नहीं है। इससे कारण पता नहीं चलता।"),
        "balance_full": "{item} के पूरे {expected} {unit} दर्ज हो चुके हैं।",
        "balance_over": "{item} के लिए पात्रता से {over_by} {unit} अधिक दर्ज किया गया है।",
        "note_excluded": (
            "{item} के {n} रिकॉर्ड कुल में शामिल नहीं किए गए। विवरण के लिए पूरी रिपोर्ट खोलें।"),
        "note_unmatched": (
            "{n} रिकॉर्ड के लिए कोई पात्रता नियम दर्ज नहीं था, इसलिए उनकी तुलना नहीं हुई।"),
        "carry_note": (
            "बचा हुआ राशन बाद में लिया जा सकता है या नहीं, यह योजना के अपने नियमों पर निर्भर "
            "करता है, जिन्हें यह टूल मानकर नहीं चलता। कृपया अपने स्थानीय कार्यालय से पूछें।"),
        "report_footer": (
            "यह रिपोर्ट दर्ज की गई मात्राओं की तुलना आपके दिए नियमों से करती है। "
            "यह किसी अंतर का कारण स्थापित नहीं करती।"),
        "email_footer": (
            "आपको यह ईमेल इसलिए मिला क्योंकि आपके खाते से RationSaathi रिपोर्ट मंगाई गई थी। "
            "RationSaathi एक स्वतंत्र टूल है और सरकारी सेवा नहीं है।"),
    },
    "mr": {
        "subject": "तुमचा RationSaathi अहवाल: {period}",
        "greeting": "नमस्कार,",
        "intro": "तुम्ही मागितलेला अहवाल हा आहे, कालावधी: {period}.",
        "expected": "अपेक्षित", "received": "मिळालेले (पुष्टी केलेले)",
        "remaining": "बाकी", "difference": "फरक",
        "open_report": "संपूर्ण अहवाल उघडा",
        "link_note": "ही लिंक असलेली कोणतीही व्यक्ती अहवाल पाहू शकते.",
        "sentence_shortfall": (
            "{item} साठी पुष्टी केलेल्या नोंदींची एकूण मात्रा {received} {unit} आहे, तर {period} "
            "साठी अपेक्षित पात्रता {expected} {unit} आहे; फरक {diff} {unit} आहे. "
            "या फरकाचे कारण निश्चित झालेले नाही."),
        "sentence_no_difference": (
            "{item} साठी पुष्टी केलेल्या नोंदींची एकूण मात्रा {received} {unit} आहे, जी {period} "
            "साठी अपेक्षित पात्रता {expected} {unit} इतकी आहे."),
        "sentence_above_expected": (
            "{item} साठी पुष्टी केलेल्या नोंदींची एकूण मात्रा {received} {unit} आहे, जी {period} "
            "साठी अपेक्षित पात्रता {expected} {unit} पेक्षा {diff} {unit} जास्त आहे."),
        "sentence_ongoing": (
            "आतापर्यंत {item} साठी पुष्टी केलेल्या नोंदींची एकूण मात्रा अपेक्षित {expected} {unit} "
            "पैकी {received} {unit} आहे. कालावधी {end} रोजी संपतो, त्यामुळे हे बदलू शकते."),
        "balance_ongoing": (
            "{item} साठीच्या तुमच्या {expected} {unit} पैकी {remaining} {unit} या कालावधीत अजून "
            "घ्यायचे आहे (आतापर्यंत {percent}% नोंद)."),
        "balance_ended": (
            "{item} च्या {expected} {unit} पात्रतेपैकी {remaining} {unit} या कालावधीत घेतल्याची "
            "नोंद नाही. यावरून कारण समजत नाही."),
        "balance_full": "{item} चे संपूर्ण {expected} {unit} नोंदवले गेले आहे.",
        "balance_over": "{item} साठी पात्रतेपेक्षा {over_by} {unit} जास्त नोंदवले गेले आहे.",
        "note_excluded": (
            "{item} च्या {n} नोंदी एकूणमध्ये धरल्या नाहीत. तपशिलासाठी संपूर्ण अहवाल उघडा."),
        "note_unmatched": (
            "{n} नोंदींसाठी पात्रता नियम दिलेला नव्हता, म्हणून त्यांची तुलना झाली नाही."),
        "carry_note": (
            "न वापरलेले रेशन नंतर घेता येते की नाही हे योजनेच्या स्वतःच्या नियमांवर अवलंबून असते, "
            "जे हे टूल गृहीत धरत नाही. कृपया तुमच्या स्थानिक कार्यालयात विचारा."),
        "report_footer": (
            "हा अहवाल नोंदवलेल्या प्रमाणांची तुलना तुम्ही दिलेल्या नियमांशी करतो. "
            "तो कोणत्याही फरकाचे कारण स्थापित करत नाही."),
        "email_footer": (
            "तुमच्या खात्यावरून RationSaathi अहवाल मागवला गेला म्हणून तुम्हाला हा ईमेल मिळाला. "
            "RationSaathi हे स्वतंत्र टूल आहे आणि ती सरकारी सेवा नाही."),
    },
}
