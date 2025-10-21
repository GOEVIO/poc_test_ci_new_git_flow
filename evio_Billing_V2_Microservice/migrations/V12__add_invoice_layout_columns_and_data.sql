-- Add new columns to invoice_layouts
ALTER TABLE invoice_layouts
    ADD COLUMN client_name VARCHAR(64),
    ADD COLUMN type VARCHAR(32),
    ADD COLUMN language VARCHAR(16),
    ADD COLUMN payment_type VARCHAR(32),
    ADD COLUMN doc_type INT,
    ADD COLUMN linked_credit_note_id VARCHAR(128);

-- Update all existing rows with new columns and values
UPDATE invoice_layouts SET client_name='EVIO', type='Invoice', language='PT_PT', payment_type=NULL, doc_type=1, linked_credit_note_id='17' WHERE id=1;
UPDATE invoice_layouts SET client_name='EVIO', type='Invoice', language='FR_FR', payment_type=NULL, doc_type=1, linked_credit_note_id='20' WHERE id=2;
UPDATE invoice_layouts SET client_name='EVIO', type='Invoice', language='EN_GB', payment_type=NULL, doc_type=1, linked_credit_note_id='18' WHERE id=3;
UPDATE invoice_layouts SET client_name='EVIO', type='Invoice', language='ES_ES', payment_type=NULL, doc_type=1, linked_credit_note_id='19' WHERE id=4;
UPDATE invoice_layouts SET client_name='Hyundai', type='Invoice', language='PT_PT', payment_type=NULL, doc_type=13, linked_credit_note_id='29' WHERE id=5;
UPDATE invoice_layouts SET client_name='Hyundai', type='Invoice', language='ES_ES', payment_type=NULL, doc_type=13, linked_credit_note_id='30' WHERE id=6;
UPDATE invoice_layouts SET client_name='Hyundai', type='Invoice', language='FR_FR', payment_type=NULL, doc_type=13, linked_credit_note_id='31' WHERE id=7;
UPDATE invoice_layouts SET client_name='Hyundai', type='Invoice', language='EN_GB', payment_type=NULL, doc_type=13, linked_credit_note_id='28' WHERE id=8;
UPDATE invoice_layouts SET client_name='ACP', type='Invoice', language='PT_PT', payment_type=NULL, doc_type=14, linked_credit_note_id='21' WHERE id=9;
UPDATE invoice_layouts SET client_name='ACP', type='Invoice', language='FR_FR', payment_type=NULL, doc_type=14, linked_credit_note_id='24' WHERE id=10;
UPDATE invoice_layouts SET client_name='ACP', type='Invoice', language='EN_GB', payment_type=NULL, doc_type=14, linked_credit_note_id='22' WHERE id=11;
UPDATE invoice_layouts SET client_name='ACP', type='Invoice', language='ES_ES', payment_type=NULL, doc_type=14, linked_credit_note_id='23' WHERE id=12;
UPDATE invoice_layouts SET client_name='Gocharge', type='Invoice', language='PT_PT', payment_type=NULL, doc_type=15, linked_credit_note_id='25' WHERE id=13;
UPDATE invoice_layouts SET client_name='Gocharge', type='Invoice', language='EN_GB', payment_type=NULL, doc_type=15, linked_credit_note_id='32' WHERE id=14;
UPDATE invoice_layouts SET client_name='Gocharge', type='Invoice', language='FR_FR', payment_type=NULL, doc_type=15, linked_credit_note_id='27' WHERE id=15;
UPDATE invoice_layouts SET client_name='Gocharge', type='Invoice', language='ES_ES', payment_type=NULL, doc_type=15, linked_credit_note_id='26' WHERE id=16;
UPDATE invoice_layouts SET client_name='ACP', type='CreditNote', language='PT_PT', payment_type=NULL, doc_type=16, linked_credit_note_id=NULL WHERE id=21;
UPDATE invoice_layouts SET client_name='ACP', type='CreditNote', language='EN_GB', payment_type=NULL, doc_type=16, linked_credit_note_id=NULL WHERE id=22;
UPDATE invoice_layouts SET client_name='ACP', type='CreditNote', language='ES_ES', payment_type=NULL, doc_type=16, linked_credit_note_id=NULL WHERE id=23;
UPDATE invoice_layouts SET client_name='ACP', type='CreditNote', language='FR_FR', payment_type=NULL, doc_type=16, linked_credit_note_id=NULL WHERE id=24;
UPDATE invoice_layouts SET client_name='Gocharge', type='CreditNote', language='PT_PT', payment_type=NULL, doc_type=17, linked_credit_note_id=NULL WHERE id=25;
UPDATE invoice_layouts SET client_name='Gocharge', type='CreditNote', language='ES_ES', payment_type=NULL, doc_type=17, linked_credit_note_id=NULL WHERE id=26;
UPDATE invoice_layouts SET client_name='Gocharge', type='CreditNote', language='FR_FR', payment_type=NULL, doc_type=17, linked_credit_note_id=NULL WHERE id=27;
UPDATE invoice_layouts SET client_name='Hyundai', type='CreditNote', language='EN_GB', payment_type=NULL, doc_type=18, linked_credit_note_id=NULL WHERE id=28;
UPDATE invoice_layouts SET client_name='Hyundai', type='CreditNote', language='PT_PT', payment_type=NULL, doc_type=18, linked_credit_note_id=NULL WHERE id=29;
UPDATE invoice_layouts SET client_name='Hyundai', type='CreditNote', language='ES_ES', payment_type=NULL, doc_type=18, linked_credit_note_id=NULL WHERE id=30;
UPDATE invoice_layouts SET client_name='Hyundai', type='CreditNote', language='FR_FR', payment_type=NULL, doc_type=18, linked_credit_note_id=NULL WHERE id=31;
UPDATE invoice_layouts SET client_name='Gocharge', type='CreditNote', language='EN_GB', payment_type=NULL, doc_type=17, linked_credit_note_id=NULL WHERE id=32;
UPDATE invoice_layouts SET client_name='EVIO', type='CreditNote', language='PT_PT', payment_type=NULL, doc_type=4, linked_credit_note_id=NULL WHERE id=17;
UPDATE invoice_layouts SET client_name='EVIO', type='CreditNote', language='EN_GB', payment_type=NULL, doc_type=4, linked_credit_note_id=NULL WHERE id=18;
UPDATE invoice_layouts SET client_name='EVIO', type='CreditNote', language='ES_ES', payment_type=NULL, doc_type=4, linked_credit_note_id=NULL WHERE id=19;
UPDATE invoice_layouts SET client_name='EVIO', type='CreditNote', language='FR_FR', payment_type=NULL, doc_type=4, linked_credit_note_id=NULL WHERE id=20;
UPDATE invoice_layouts SET client_name='EVIO', type='Invoice', language='PT_PT', payment_type='AD_HOC', doc_type=22, linked_credit_note_id='49' WHERE id=33;
UPDATE invoice_layouts SET client_name='EVIO', type='Invoice', language='FR_FR', payment_type='AD_HOC', doc_type=22, linked_credit_note_id='52' WHERE id=34;
UPDATE invoice_layouts SET client_name='EVIO', type='Invoice', language='EN_GB', payment_type='AD_HOC', doc_type=22, linked_credit_note_id='50' WHERE id=35;
UPDATE invoice_layouts SET client_name='EVIO', type='Invoice', language='ES_ES', payment_type='AD_HOC', doc_type=22, linked_credit_note_id='55' WHERE id=36;
UPDATE invoice_layouts SET client_name='ACP', type='Invoice', language='PT_PT', payment_type='AD_HOC', doc_type=23, linked_credit_note_id='53' WHERE id=37;
UPDATE invoice_layouts SET client_name='ACP', type='Invoice', language='FR_FR', payment_type='AD_HOC', doc_type=23, linked_credit_note_id='56' WHERE id=38;
UPDATE invoice_layouts SET client_name='ACP', type='Invoice', language='EN_GB', payment_type='AD_HOC', doc_type=23, linked_credit_note_id='54' WHERE id=39;
UPDATE invoice_layouts SET client_name='ACP', type='Invoice', language='ES_ES', payment_type='AD_HOC', doc_type=23, linked_credit_note_id='55' WHERE id=40;
UPDATE invoice_layouts SET client_name='Gocharge', type='Invoice', language='PT_PT', payment_type='AD_HOC', doc_type=24, linked_credit_note_id='57' WHERE id=41;
UPDATE invoice_layouts SET client_name='Gocharge', type='Invoice', language='EN_GB', payment_type='AD_HOC', doc_type=24, linked_credit_note_id='60' WHERE id=42;
UPDATE invoice_layouts SET client_name='Gocharge', type='Invoice', language='FR_FR', payment_type='AD_HOC', doc_type=24, linked_credit_note_id='59' WHERE id=43;
UPDATE invoice_layouts SET client_name='Gocharge', type='Invoice', language='ES_ES', payment_type='AD_HOC', doc_type=24, linked_credit_note_id='58' WHERE id=44;
UPDATE invoice_layouts SET client_name='Hyundai', type='Invoice', language='PT_PT', payment_type='AD_HOC', doc_type=25, linked_credit_note_id='62' WHERE id=45;
UPDATE invoice_layouts SET client_name='Hyundai', type='Invoice', language='ES_ES', payment_type='AD_HOC', doc_type=25, linked_credit_note_id='63' WHERE id=46;
UPDATE invoice_layouts SET client_name='Hyundai', type='Invoice', language='FR_FR', payment_type='AD_HOC', doc_type=25, linked_credit_note_id='64' WHERE id=47;
UPDATE invoice_layouts SET client_name='Hyundai', type='Invoice', language='EN_GB', payment_type='AD_HOC', doc_type=25, linked_credit_note_id='61' WHERE id=48;
UPDATE invoice_layouts SET client_name='EVIO', type='CreditNote', language='PT_PT', payment_type='AD_HOC', doc_type=26, linked_credit_note_id=NULL WHERE id=49;
UPDATE invoice_layouts SET client_name='EVIO', type='CreditNote', language='EN_GB', payment_type='AD_HOC', doc_type=26, linked_credit_note_id=NULL WHERE id=50;
UPDATE invoice_layouts SET client_name='EVIO', type='CreditNote', language='ES_ES', payment_type='AD_HOC', doc_type=26, linked_credit_note_id=NULL WHERE id=51;
UPDATE invoice_layouts SET client_name='EVIO', type='CreditNote', language='FR_FR', payment_type='AD_HOC', doc_type=26, linked_credit_note_id=NULL WHERE id=52;
UPDATE invoice_layouts SET client_name='ACP', type='CreditNote', language='PT_PT', payment_type='AD_HOC', doc_type=27, linked_credit_note_id=NULL WHERE id=53;
UPDATE invoice_layouts SET client_name='ACP', type='CreditNote', language='EN_GB', payment_type='AD_HOC', doc_type=27, linked_credit_note_id=NULL WHERE id=54;
UPDATE invoice_layouts SET client_name='ACP', type='CreditNote', language='ES_ES', payment_type='AD_HOC', doc_type=27, linked_credit_note_id=NULL WHERE id=55;
UPDATE invoice_layouts SET client_name='ACP', type='CreditNote', language='FR_FR', payment_type='AD_HOC', doc_type=27, linked_credit_note_id=NULL WHERE id=56;
UPDATE invoice_layouts SET client_name='Gocharge', type='CreditNote', language='PT_PT', payment_type='AD_HOC', doc_type=28, linked_credit_note_id=NULL WHERE id=57;
UPDATE invoice_layouts SET client_name='Gocharge', type='CreditNote', language='ES_ES', payment_type='AD_HOC', doc_type=28, linked_credit_note_id=NULL WHERE id=58;
UPDATE invoice_layouts SET client_name='Gocharge', type='CreditNote', language='FR_FR', payment_type='AD_HOC', doc_type=28, linked_credit_note_id=NULL WHERE id=59;
UPDATE invoice_layouts SET client_name='Gocharge', type='CreditNote', language='EN_GB', payment_type='AD_HOC', doc_type=28, linked_credit_note_id=NULL WHERE id=60;
UPDATE invoice_layouts SET client_name='Hyundai', type='CreditNote', language='EN_GB', payment_type='AD_HOC', doc_type=29, linked_credit_note_id=NULL WHERE id=61;
UPDATE invoice_layouts SET client_name='Hyundai', type='CreditNote', language='PT_PT', payment_type='AD_HOC', doc_type=29, linked_credit_note_id=NULL WHERE id=62;
UPDATE invoice_layouts SET client_name='Hyundai', type='CreditNote', language='ES_ES', payment_type='AD_HOC', doc_type=29, linked_credit_note_id=NULL WHERE id=63;
UPDATE invoice_layouts SET client_name='Hyundai', type='CreditNote', language='FR_FR', payment_type='AD_HOC', doc_type=29, linked_credit_note_id=NULL WHERE id=64;

