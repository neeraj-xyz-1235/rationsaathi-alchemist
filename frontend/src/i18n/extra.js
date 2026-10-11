// Added on top of workspace.js: item names, complaints draft, help centre, receipt lookup miss.
import { workspace } from './workspace.js'

Object.assign(workspace.en, {
  item_rice: 'Rice', item_wheat: 'Wheat', wd_verify_notfound: 'No receipt was issued with this reference or code.',
  cp_title: 'Prepare a query or complaint draft', cp_note: 'This form does not submit to an authority. Copy the details into the official channel you choose.',
  cp_topic: 'Topic', cp_t1: 'Ration quantity query', cp_t2: 'Shop opening hours', cp_t3: 'Receipt or record correction', cp_t4: 'Other question',
  cp_details: 'Details', cp_details_ph: 'Describe the date, item, quantity, and what you want clarified. Avoid sharing sensitive IDs.', cp_save: 'Save draft',
  cp_info_title: 'Useful information to keep', cp_i1: 'Date and approximate time of the visit.', cp_i2: 'Item and quantity shown on the receipt.',
  cp_i3: 'Receipt reference, if available.', cp_i4: 'A clear description of the question you want answered.',
  cp_urgent: 'For urgent or official issues, use the relevant government grievance channel.',
  hp_check_text: 'Start with your household category and the applicable rules, then calculate your monthly allocation.',
  hp_track_title: 'Track deliveries', hp_track_text: 'Record item, quantity, date, and a receipt reference. Keep original documents somewhere safe.',
  hp_reports_title: 'Read reports carefully', hp_reports_text: 'A numerical difference may have many explanations. Verify records and applicable rules before drawing conclusions.',
  hp_privacy_title: 'Protect your privacy', hp_privacy_text: 'Avoid entering Aadhaar, bank account, passwords, or other highly sensitive information into notes.', hp_privacy_link: 'Read privacy information',
})

Object.assign(workspace.hi, {
  item_rice: 'चावल', item_wheat: 'गेहूं', wd_verify_notfound: 'इस संदर्भ या कोड से कोई रसीद जारी नहीं हुई।',
  cp_title: 'प्रश्न या शिकायत का मसौदा तैयार करें', cp_note: 'यह फ़ॉर्म किसी प्राधिकारी को नहीं भेजा जाता। विवरण कॉपी करके अपनी चुनी आधिकारिक जगह पर दें।',
  cp_topic: 'विषय', cp_t1: 'राशन की मात्रा का प्रश्न', cp_t2: 'दुकान के खुलने का समय', cp_t3: 'रसीद या रिकॉर्ड में सुधार', cp_t4: 'अन्य प्रश्न',
  cp_details: 'विवरण', cp_details_ph: 'तारीख, वस्तु, मात्रा और आप क्या स्पष्ट कराना चाहते हैं, यह लिखें। संवेदनशील पहचान-पत्र न लिखें।', cp_save: 'मसौदा सहेजें',
  cp_info_title: 'रखने योग्य उपयोगी जानकारी', cp_i1: 'दुकान जाने की तारीख और लगभग समय।', cp_i2: 'रसीद पर दिखाई गई वस्तु और मात्रा।',
  cp_i3: 'रसीद संदर्भ, यदि उपलब्ध हो।', cp_i4: 'आप जो प्रश्न पूछना चाहते हैं उसका स्पष्ट विवरण।',
  cp_urgent: 'ज़रूरी या आधिकारिक मामलों के लिए संबंधित सरकारी शिकायत माध्यम का उपयोग करें।',
  hp_check_text: 'अपने परिवार की श्रेणी और लागू नियमों से शुरू करें, फिर अपना मासिक आवंटन निकालें।',
  hp_track_title: 'वितरण ट्रैक करें', hp_track_text: 'वस्तु, मात्रा, तारीख और रसीद संदर्भ दर्ज करें। मूल दस्तावेज़ सुरक्षित रखें।',
  hp_reports_title: 'रिपोर्ट ध्यान से पढ़ें', hp_reports_text: 'संख्या में अंतर के कई कारण हो सकते हैं। निष्कर्ष निकालने से पहले रिकॉर्ड और लागू नियम जांचें।',
  hp_privacy_title: 'अपनी गोपनीयता बचाएं', hp_privacy_text: 'नोट्स में आधार, बैंक खाता, पासवर्ड या अन्य अत्यंत संवेदनशील जानकारी न डालें।', hp_privacy_link: 'गोपनीयता जानकारी पढ़ें',
})

Object.assign(workspace.mr, {
  item_rice: 'तांदूळ', item_wheat: 'गहू', wd_verify_notfound: 'या संदर्भ किंवा कोडने कोणतीही पावती दिलेली नाही.',
  cp_title: 'प्रश्न किंवा तक्रारीचा मसुदा तयार करा', cp_note: 'हा फॉर्म कोणत्याही प्राधिकरणाला पाठवला जात नाही. तपशील कॉपी करून तुम्ही निवडलेल्या अधिकृत ठिकाणी द्या.',
  cp_topic: 'विषय', cp_t1: 'रेशन प्रमाणाबद्दल प्रश्न', cp_t2: 'दुकान उघडण्याच्या वेळा', cp_t3: 'पावती किंवा नोंदीत दुरुस्ती', cp_t4: 'इतर प्रश्न',
  cp_details: 'तपशील', cp_details_ph: 'तारीख, वस्तू, प्रमाण आणि तुम्हाला काय स्पष्ट करून घ्यायचे आहे ते लिहा. संवेदनशील ओळखपत्रे लिहू नका.', cp_save: 'मसुदा जतन करा',
  cp_info_title: 'ठेवण्यासारखी उपयुक्त माहिती', cp_i1: 'दुकानात गेल्याची तारीख आणि अंदाजे वेळ.', cp_i2: 'पावतीवर दाखवलेली वस्तू आणि प्रमाण.',
  cp_i3: 'पावतीचा संदर्भ, उपलब्ध असल्यास.', cp_i4: 'तुम्हाला ज्या प्रश्नाचे उत्तर हवे त्याचे स्पष्ट वर्णन.',
  cp_urgent: 'तातडीच्या किंवा अधिकृत बाबींसाठी संबंधित सरकारी तक्रार माध्यम वापरा.',
  hp_check_text: 'तुमच्या कुटुंबाच्या श्रेणीपासून आणि लागू नियमांपासून सुरुवात करा, मग तुमचे मासिक वाटप काढा.',
  hp_track_title: 'वितरण नोंदवा', hp_track_text: 'वस्तू, प्रमाण, तारीख आणि पावतीचा संदर्भ नोंदवा. मूळ कागदपत्रे सुरक्षित ठेवा.',
  hp_reports_title: 'अहवाल काळजीपूर्वक वाचा', hp_reports_text: 'आकड्यातील फरकाची अनेक कारणे असू शकतात. निष्कर्ष काढण्यापूर्वी नोंदी आणि लागू नियम तपासा.',
  hp_privacy_title: 'तुमची गोपनीयता जपा', hp_privacy_text: 'नोट्समध्ये आधार, बँक खाते, पासवर्ड किंवा इतर अत्यंत संवेदनशील माहिती टाकू नका.', hp_privacy_link: 'गोपनीयता माहिती वाचा',
})

// Receipt-photo proof on withdrawals
Object.assign(workspace.en, {
  wd_photo: 'Shop receipt photo (optional)', wd_photo_note: 'A clear photo of the receipt lets us check the item and quantity. The photo is not stored.',
  wd_proof_title: 'RECEIPT PHOTO CHECK', wd_proof_none: 'No photo', wd_proof_verified: 'Receipt matches', wd_proof_mismatch: 'Does not match', wd_proof_unreadable: 'Could not be read',
  wd_proof_attach: 'Add receipt photo', wd_proof_checking: 'Checking…', wd_proof_err: 'The receipt photo could not be checked. Please try again.',
  wd_pr_MATCHED: 'The item and quantity on the receipt match your entry.', wd_pr_DETAILS_DO_NOT_MATCH: 'Something on the receipt differs from your entry. Check the quantity, item and date.',
  wd_pr_NOT_A_RECEIPT: 'This does not look like a shop receipt.', wd_pr_RECEIPT_UNREADABLE: 'The item or quantity could not be read. Try a clearer, well-lit photo.',
  wd_pr_AI_UNAVAILABLE: 'The photo check is not available right now.', wd_pr_PDF_NOT_READ: 'PDF files are saved but not read. Use a photo (JPG or PNG) to check it.',
  wd_pr_PHOTO_ALREADY_USED: 'This photo was already used for another withdrawal.',
})
Object.assign(workspace.hi, {
  wd_photo: 'दुकान की रसीद की फ़ोटो (वैकल्पिक)', wd_photo_note: 'रसीद की साफ़ फ़ोटो से हम वस्तु और मात्रा जांच सकते हैं। फ़ोटो सहेजी नहीं जाती।',
  wd_proof_title: 'रसीद फ़ोटो की जांच', wd_proof_none: 'फ़ोटो नहीं', wd_proof_verified: 'रसीद मेल खाती है', wd_proof_mismatch: 'मेल नहीं खाती', wd_proof_unreadable: 'पढ़ी नहीं जा सकी',
  wd_proof_attach: 'रसीद फ़ोटो जोड़ें', wd_proof_checking: 'जांच हो रही है…', wd_proof_err: 'रसीद की फ़ोटो जांची नहीं जा सकी। कृपया फिर कोशिश करें।',
  wd_pr_MATCHED: 'रसीद की वस्तु और मात्रा आपकी प्रविष्टि से मेल खाती है।', wd_pr_DETAILS_DO_NOT_MATCH: 'रसीद की कोई बात आपकी प्रविष्टि से अलग है। मात्रा, वस्तु और तारीख जांचें।',
  wd_pr_NOT_A_RECEIPT: 'यह दुकान की रसीद जैसी नहीं दिखती।', wd_pr_RECEIPT_UNREADABLE: 'वस्तु या मात्रा पढ़ी नहीं जा सकी। अधिक साफ़, रोशनी वाली फ़ोटो लें।',
  wd_pr_AI_UNAVAILABLE: 'फ़ोटो की जांच अभी उपलब्ध नहीं है।', wd_pr_PDF_NOT_READ: 'PDF फ़ाइलें सहेजी जाती हैं पर पढ़ी नहीं जातीं। जांच के लिए फ़ोटो (JPG या PNG) दें।',
  wd_pr_PHOTO_ALREADY_USED: 'यह फ़ोटो पहले ही किसी दूसरी निकासी के लिए उपयोग हो चुकी है।',
})
Object.assign(workspace.mr, {
  wd_photo: 'दुकानाच्या पावतीचा फोटो (ऐच्छिक)', wd_photo_note: 'पावतीच्या स्पष्ट फोटोमुळे आम्ही वस्तू आणि प्रमाण तपासू शकतो. फोटो जतन केला जात नाही.',
  wd_proof_title: 'पावती फोटो तपासणी', wd_proof_none: 'फोटो नाही', wd_proof_verified: 'पावती जुळते', wd_proof_mismatch: 'जुळत नाही', wd_proof_unreadable: 'वाचता आली नाही',
  wd_proof_attach: 'पावतीचा फोटो जोडा', wd_proof_checking: 'तपासत आहे…', wd_proof_err: 'पावतीचा फोटो तपासता आला नाही. कृपया पुन्हा प्रयत्न करा.',
  wd_pr_MATCHED: 'पावतीवरील वस्तू आणि प्रमाण तुमच्या नोंदीशी जुळते.', wd_pr_DETAILS_DO_NOT_MATCH: 'पावतीवरील काहीतरी तुमच्या नोंदीपेक्षा वेगळे आहे. प्रमाण, वस्तू आणि तारीख तपासा.',
  wd_pr_NOT_A_RECEIPT: 'हे दुकानाच्या पावतीसारखे दिसत नाही.', wd_pr_RECEIPT_UNREADABLE: 'वस्तू किंवा प्रमाण वाचता आले नाही. अधिक स्पष्ट, उजेडातील फोटो घ्या.',
  wd_pr_AI_UNAVAILABLE: 'फोटो तपासणी सध्या उपलब्ध नाही.', wd_pr_PDF_NOT_READ: 'PDF फाइल्स जतन होतात पण वाचल्या जात नाहीत. तपासणीसाठी फोटो (JPG किंवा PNG) द्या.',
  wd_pr_PHOTO_ALREADY_USED: 'हा फोटो आधीच दुसऱ्या उचलीसाठी वापरला गेला आहे.',
})

// Receipt photo is required and pre-fills the form
Object.assign(workspace.en, {
  wd_photo: 'Shop receipt photo', wd_photo_note: 'Choose a clear photo of the receipt. The item, quantity and date are read from it and filled in above. The photo is not stored.',
  wd_extracting: 'Reading your receipt…', wd_extracted_note: 'Filled in from your receipt. Please check the details above before recording.',
  wd_extract_RECEIPT_UNREADABLE: 'We could not read the receipt. Try a clearer photo, or fill in the details yourself.',
  wd_extract_NOT_A_RECEIPT: 'This does not look like a shop receipt. Try another photo.',
  wd_extract_AI_UNAVAILABLE: 'The receipt reader is not available right now. Fill in the details yourself.',
  wd_extract_PDF_NOT_READ: 'PDF files cannot be read. Use a photo (JPG or PNG), or fill in the details yourself.',
  wd_err_photo: 'Add a photo of the shop receipt to record this withdrawal.',
})
Object.assign(workspace.hi, {
  wd_photo: 'दुकान की रसीद की फ़ोटो', wd_photo_note: 'रसीद की साफ़ फ़ोटो चुनें। उससे वस्तु, मात्रा और तारीख पढ़कर ऊपर भर दी जाती हैं। फ़ोटो सहेजी नहीं जाती।',
  wd_extracting: 'आपकी रसीद पढ़ी जा रही है…', wd_extracted_note: 'रसीद से भरा गया। दर्ज करने से पहले ऊपर का विवरण जांच लें।',
  wd_extract_RECEIPT_UNREADABLE: 'रसीद पढ़ी नहीं जा सकी। अधिक साफ़ फ़ोटो लें, या विवरण खुद भरें।',
  wd_extract_NOT_A_RECEIPT: 'यह दुकान की रसीद जैसी नहीं दिखती। दूसरी फ़ोटो लें।',
  wd_extract_AI_UNAVAILABLE: 'रसीद पढ़ने की सुविधा अभी उपलब्ध नहीं है। विवरण खुद भरें।',
  wd_extract_PDF_NOT_READ: 'PDF फ़ाइलें पढ़ी नहीं जा सकतीं। फ़ोटो (JPG या PNG) दें, या विवरण खुद भरें।',
  wd_err_photo: 'यह निकासी दर्ज करने के लिए दुकान की रसीद की फ़ोटो जोड़ें।',
})
Object.assign(workspace.mr, {
  wd_photo: 'दुकानाच्या पावतीचा फोटो', wd_photo_note: 'पावतीचा स्पष्ट फोटो निवडा. त्यातून वस्तू, प्रमाण आणि तारीख वाचून वर भरली जातात. फोटो जतन केला जात नाही.',
  wd_extracting: 'तुमची पावती वाचत आहे…', wd_extracted_note: 'पावतीवरून भरले आहे. नोंदवण्यापूर्वी वरील तपशील तपासा.',
  wd_extract_RECEIPT_UNREADABLE: 'पावती वाचता आली नाही. अधिक स्पष्ट फोटो घ्या, किंवा तपशील स्वतः भरा.',
  wd_extract_NOT_A_RECEIPT: 'हे दुकानाच्या पावतीसारखे दिसत नाही. दुसरा फोटो घ्या.',
  wd_extract_AI_UNAVAILABLE: 'पावती वाचण्याची सुविधा सध्या उपलब्ध नाही. तपशील स्वतः भरा.',
  wd_extract_PDF_NOT_READ: 'PDF फाइल्स वाचता येत नाहीत. फोटो (JPG किंवा PNG) द्या, किंवा तपशील स्वतः भरा.',
  wd_err_photo: 'ही उचल नोंदवण्यासाठी दुकानाच्या पावतीचा फोटो जोडा.',
})
