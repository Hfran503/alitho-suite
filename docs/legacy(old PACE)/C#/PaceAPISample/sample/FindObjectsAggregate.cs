using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using efipaceservices;

namespace Pace_Web_Service_SDK.sample
{
    class FindObjectsAggregate
    {
        public static void Run()
        {
            FindObjectsPortType findObjectsHttpBinding = PaceClient.getFindObjectsHttpBinding();

            //create the Job ValueObjectDescriptor for first batch of 10 records
            ValueObjectDescriptor jobDescriptor = createJobDescriptor(0, 10);

            // Open Job aggregate value object loader Sample
            ValueObjectsGroup jobVOs = findObjectsHttpBinding.loadValueObjects(jobDescriptor);
            printValueObjectGroupDetail(jobVOs, 0);

            //if there are more records, print the next batch.
            //Note:- you may use this pagination feature on any level of ValueObjectDescriptors
            if (jobVOs.totalRecords > 10)
            {
                printValueObjectGroupDetail(findObjectsHttpBinding.loadValueObjects(createJobDescriptor(11, 10)), 0);
            }
            
        }

        private static void printValueObjectGroupDetail(ValueObjectsGroup voGroup, int level)
        {
            String padding = getPadding(level);

            Console.WriteLine(padding + "Total " + voGroup.objectName + " available " + voGroup.totalRecords);

            ValueObject[] vos = voGroup.valueObjects;

            foreach (ValueObject valueObject in vos)
            {
                ValueField[] fields = valueObject.fields;
                Console.WriteLine(padding + "*** " + valueObject.objectName + " PK:" + valueObject.primaryKey + " ***");

                foreach (ValueField valueField in fields)
                {
                    Console.WriteLine(padding + valueObject.objectName + " Field: Name=" + valueField.name + ", Type=" + valueField.type + ",Value=" + valueField.value + ", XPath= " + valueField.xpath);
                }

                ValueObjectsGroup[] children = valueObject.children;

                foreach (ValueObjectsGroup child in children)
                {
                    printValueObjectGroupDetail(child, level + 1);
                }
                Console.WriteLine(padding + "*** " + valueObject.objectName + " PK:" + valueObject.primaryKey + " ***");
            }
        }

        private static String getPadding(int level)
        {
            String paddingString = "";
            for (int i = 0; i < level; i++)
            {
                paddingString += "\t";
            }
            return paddingString.ToString();
        }


        private static ValueObjectDescriptor createJobDescriptor(int offset, int limit)
        {
            // create the root ValueObjectDescriptor
            ValueObjectDescriptor jobDescriptor = new ValueObjectDescriptor();
            // set descriptor properties for Job lookup
            jobDescriptor.objectName = "Job";
            jobDescriptor.offset = offset;
            jobDescriptor.limit = limit;
            jobDescriptor.xpathFilter = "adminStatus/@openJob";

            // create fields to lookup
            List<FieldDescriptor> jobFieldDescriptors = new List<FieldDescriptor>();

            FieldDescriptor fieldDescriptor2 = new FieldDescriptor();
            fieldDescriptor2.name = "description";
            fieldDescriptor2.xpath = "@description";
            jobFieldDescriptors.Add(fieldDescriptor2);


            FieldDescriptor fieldDescriptor3 = new FieldDescriptor();
            fieldDescriptor3.name = "promiseDate";
            fieldDescriptor3.xpath = "@promiseDate";
            jobFieldDescriptors.Add(fieldDescriptor3);


            FieldDescriptor fieldDescriptor4 = new FieldDescriptor();
            fieldDescriptor4.name = "promiseTime";
            fieldDescriptor4.xpath = "@promiseTime";
            jobFieldDescriptors.Add(fieldDescriptor4);

            // add fields to job descriptor
            jobDescriptor.fields = jobFieldDescriptors.ToArray();

            // define sorts to be used
            XPathDataSort[] sort = new XPathDataSort[2];

            XPathDataSort xPathDataSort1 = new XPathDataSort();
            xPathDataSort1.descending = false;
            xPathDataSort1.xpath = "customer/@custName";

            XPathDataSort xPathDataSort2 = new XPathDataSort();
            xPathDataSort2.descending = true;
            xPathDataSort2.xpath = "@description";

            sort[0] = xPathDataSort1;
            sort[1] = xPathDataSort2;

            jobDescriptor.xpathSorts = sort;

            // create the JobPart descriptor that we want to pull with the Jobs
            ValueObjectDescriptor jobPartDescriptor = new ValueObjectDescriptor();
            jobPartDescriptor.objectName = "JobPart";
            jobPartDescriptor.offset = 0;
            jobPartDescriptor.limit = 10;
            // xpath is relative to this object. Leave null if you do not need a filter at this level
            //The parent filter will automatically be applied for the children
            //For eg:- the below filter will always be evaluated in context of the selected Job
            jobPartDescriptor.xpathFilter = "productionStatus/@openJob";

            // create fields to lookup
            List<FieldDescriptor> jobPartFieldDescriptors = new List<FieldDescriptor>();

            FieldDescriptor jobPartfieldDescriptor1 = new FieldDescriptor();
            jobPartfieldDescriptor1.name = "job";
            jobPartfieldDescriptor1.xpath = "@job";
            jobPartFieldDescriptors.Add(jobPartfieldDescriptor1);

            FieldDescriptor jobPartfieldDescriptor2 = new FieldDescriptor();
            jobPartfieldDescriptor2.name = "jobPart";
            jobPartfieldDescriptor2.xpath = "@jobPart";
            jobPartFieldDescriptors.Add(jobPartfieldDescriptor2);


            FieldDescriptor jobPartfieldDescriptor3 = new FieldDescriptor();
            jobPartfieldDescriptor3.name = "productionStatusDesc";
            jobPartfieldDescriptor3.xpath = "productionStatus/@description";
            jobPartFieldDescriptors.Add(jobPartfieldDescriptor3);

            FieldDescriptor jobPartfieldDescriptor4 = new FieldDescriptor();
            jobPartfieldDescriptor4.name = "qtyToMfg";
            jobPartfieldDescriptor4.xpath = "@qtyToMfg";
            jobPartFieldDescriptors.Add(jobPartfieldDescriptor4);

            jobPartDescriptor.fields = jobPartFieldDescriptors.ToArray();


            // create the JobShipment descriptor that we want to pull with the Jobs
            ValueObjectDescriptor jobShipmentDescriptor = new ValueObjectDescriptor();
            jobShipmentDescriptor.objectName = "JobShipment";
            jobShipmentDescriptor.offset = 0;
            jobShipmentDescriptor.limit = 10;

            // create fields to lookup
            List<FieldDescriptor> jobShipmentFieldDescriptors = new List<FieldDescriptor>();

            FieldDescriptor jobShipmentFieldDescriptor1 = new FieldDescriptor();
            jobShipmentFieldDescriptor1.name = "id";
            jobShipmentFieldDescriptor1.xpath = "@id";

            FieldDescriptor jobShipmentFieldDescriptor2 = new FieldDescriptor();
            jobShipmentFieldDescriptor2.name = "job";
            jobShipmentFieldDescriptor2.xpath = "@job";

            FieldDescriptor jobShipmentFieldDescriptor3 = new FieldDescriptor();
            jobShipmentFieldDescriptor3.name = "jobPart";
            jobShipmentFieldDescriptor3.xpath = "@jobPart";

            FieldDescriptor jobShipmentFieldDescriptor4 = new FieldDescriptor();
            jobShipmentFieldDescriptor4.name = "Shipment Type";
            jobShipmentFieldDescriptor4.xpath = "@shipmentType/@description";

            // add fields to jobpart descriptor
            jobShipmentDescriptor.fields = jobShipmentFieldDescriptors.ToArray();

            // set the child in the jobdescriptor
            jobDescriptor.children = new ValueObjectDescriptor[] { jobPartDescriptor, jobShipmentDescriptor };

            return jobDescriptor;
        }

    }
}
