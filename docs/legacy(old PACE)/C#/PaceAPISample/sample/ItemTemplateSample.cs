using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class ItemTemplateSample
    {
        private static CreateObjectPortType createObjectHttpBinding = PaceClient.getCreateObjectHttpBinding();
        public static void Run()
        {
            ItemTemplate template = createItemTemplate( "TMP" );
            Job job = createJob( template );
            Console.WriteLine( "Job " + job.job + " - " + job.description + " created of job value - " + job.jobValue );
            FindObjectsPortType findObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding();
            ArrayOfString formIds = findObjectsHttpBinding.find("JobPartPressForm", "@job='" + job.job + "' and @jobPart='01'");

            if (1 == formIds.Count)
            {
                Console.WriteLine("Successfully applied template");
            }
            else
            {
                Console.WriteLine("Error applying template.");
            }
        }

        public static ItemTemplate createItemTemplate(String code)
        {
            // 1. Create item template.
            ItemTemplate template = new ItemTemplate();
            template.code = code;
            template.description = "Sample Template";
            template.itemTemplateType = "VAR";//seeded item template type
            template.jobProductType = "DSFDEF"; //seeded job product type
            template.salesCategory = 1; //seeded sales category
            template.baseObject = "JobPart";
            template.qtyOptions = 2; //N/A=0, 1=1, Multiple=2
            template = createObjectHttpBinding.createItemTemplate(template);
 
            // 2. Create Item template lines for the above item template
            ItemTemplateLine line1 = new ItemTemplateLine();
            line1.itemTemplate = template.code;
            line1.dataObject = "JobPartPressForm";
            line1 = createObjectHttpBinding.createItemTemplateLine(line1);

            // 3. Create item template line attributes
            ItemTemplateLineAttribute line1Attr1 = new ItemTemplateLineAttribute();
            line1Attr1.itemTemplateLine = line1.id;
            line1Attr1.attribute = "formNum";
            line1Attr1.expressionType = 2; //xpath=1, static=2, external-xpath=3
            line1Attr1.defaultValue = "1";
            line1Attr1 = createObjectHttpBinding.createItemTemplateLineAttribute(line1Attr1);

            ItemTemplateLineAttribute line1Attr2 = new ItemTemplateLineAttribute();
            line1Attr2.itemTemplateLine = line1.id;
            line1Attr2.attribute = "numUp";
            line1Attr2.expressionType = 2; //xpath=1, static=2, external-xpath=3
            line1Attr2.defaultValue = "1";
            line1Attr2 = createObjectHttpBinding.createItemTemplateLineAttribute(line1Attr2);

            ItemTemplateLineAttribute line1Attr3 = new ItemTemplateLineAttribute();
            line1Attr3.itemTemplateLine = line1.id;
            line1Attr3.attribute = "press";
            line1Attr3.expressionType = 2; //xpath=1, static=2, external-xpath=3
            line1Attr3.defaultValue = "1"; //seeded press
            line1Attr3 = createObjectHttpBinding.createItemTemplateLineAttribute(line1Attr3);

            ItemTemplateLineAttribute line1Attr4 = new ItemTemplateLineAttribute();
            line1Attr4.itemTemplateLine = line1.id;
            line1Attr4.attribute = "qtyToMfg";
            line1Attr4.expressionType = 1; //xpath=1, static=2, external-xpath=3
            line1Attr4.defaultValue = "../@qtyToMfg"; //seeded press
            line1Attr4 = createObjectHttpBinding.createItemTemplateLineAttribute(line1Attr4);

            return template;
        }

        public static Job createJob(ItemTemplate template)
        {
            Job job = new Job();
            job.description = "Created from template - " + template.description;
            job.customer = "HOUSE";
            job.itemTemplate = template.code;
            job.part1QuantityOrdered = 10;
            job = createObjectHttpBinding.createJob(job);
            return job;
        }
    }
    
}
