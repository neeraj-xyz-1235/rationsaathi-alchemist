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
