package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.ArrayList;
import java.util.Date;
import java.util.GregorianCalendar;
import java.util.List;
import javax.xml.datatype.DatatypeConfigurationException;
import javax.xml.datatype.DatatypeFactory;

import com.pace2020.epace.object.ComboJob;
import com.pace2020.epace.object.Customer;
import com.pace2020.epace.object.Estimate;
import com.pace2020.epace.object.EstimateConvertToJob;
import com.pace2020.epace.object.EstimateQuantity;
import com.pace2020.epace.object.ItemTemplate;
import com.pace2020.epace.object.ItemTemplateLine;
import com.pace2020.epace.object.ItemTemplateLineAttribute;
import com.pace2020.epace.object.Job;
import com.pace2020.epace.object.JobPart;
import com.pace2020.epace.object.JobType;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;
import com.pace2020.epace.services.rpc.EstimateConvertToJobPart;

/**
 * @author <a href="mailto:faizanr@efi.com">faizan raza</a>
 */
public class CreateTwoJobsUsingItemTemplatesAndCreateComboJobSample extends SecuredWSDLClient
{
    private final String m_customerCode;
    private final String m_quantityOrdered;

    public CreateTwoJobsUsingItemTemplatesAndCreateComboJobSample( final String customerCode,
                                                                   final String quantityOrdered )
    {
        m_customerCode = customerCode;
        m_quantityOrdered = quantityOrdered;
    }

    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 2 parameters passed in
        if( args.length != 2 )
        {
            throw new Exception( "Usage: CreateJob <CUSTCODE> <QTYORDERED>" );

        }
        else
        {
            final CreateTwoJobsUsingItemTemplatesAndCreateComboJobSample createJob =
                new CreateTwoJobsUsingItemTemplatesAndCreateComboJobSample( args[0], args[1] );

            createJob.run();
        }
    }

    public Job run() throws Exception
    {
        final List<JobPart> parts = new ArrayList<>();

        final Job job = createJob( getOrCreateItemTemplate( "TMP" ), parts );

        final Job jobMultipleParts = createJobMultipleParts( getOrCreateItemTemplate( "TMP" ), parts );

        System.out.println( "Job " + job.getJob() + " - " + job.getDescription() + " created of job value - " + job
            .getJobValue() );

        final List<String> formIds =
            getFindObjectsPortType().find( "JobPartPressForm", "@job='" + job.getJob() + "' and @jobPart='01'" )
                .getString();

        if( 1 == formIds.size() )
        {
            System.out.println( "Successfully applied template." );
        }
        else
        {
            System.out.println( "Error applying template." );
        }

        //now create a Combo Job using the 3 parts we just created

        Job combo = new Job();
        combo.setDescription( "Combo job from API" );
        combo.setCustomer( "HOUSE" );

        // set job type = JobType for combo jobs
        combo.setJobType( 9 );

        combo.setPart1QuantityOrdered( Integer.valueOf( m_quantityOrdered ) );
        combo = getCreateObjectPortType().createJob( combo );

        System.out.println( "Created combo job for '"
                                + combo.getCustomer()
                                + "' on "
                                + combo.getDateSetup() );

        System.out.println( "Job add addition complete for " + combo.getJob() );

        JobPart comboPartOne = getJobPart( "01", job );

        for( final JobPart part : parts )
        {
            // for each part put it in the combo
            ComboJob comboPart = new ComboJob();

            comboPart.setJob( part.getJob() );
            comboPart.setJobPart( part.getJobPart() );
            comboPart.setComboJob( combo.getJob() );

            getCreateObjectPortType().createComboJob( comboPart );

            System.out.println( "Finished adding part to the combo Job " + part.getJobPart() );
        }

        final GregorianCalendar gc = new GregorianCalendar();

        gc.setTime( new Date() );

        Customer cust = new Customer();

        cust.setId( "HOUSE" );

        JobType type = new JobType();

        type.setId( new Integer( 1 ) );

        try
        {
            final Estimate estimate = getInvokeActionPortType().convertJobToEstimate( combo );

            if( null != estimate )
            {
                // estimate creation worked, now convert it back to the combo job
                convertEstimateIntoJob( combo, gc, cust, type, estimate );
            }
        }
        catch( Exception e )
        {
            if( e.getMessage().startsWith( "Job is not valid for convert to estimate" ) )
            {
                System.out.println( "Unable to convert to Estimate.  You must fill out more part details" );
            }
            else
            {
                throw new RemoteException( "Unable to find customer", e );
            }
        }
        return combo;
    }

    private void convertEstimateIntoJob( final Job combo, final GregorianCalendar gc, Customer cust,
                                         final JobType type, final Estimate estimate )
        throws DatatypeConfigurationException
    {
        // Get a new Convert To Job bean for this estimate, bean is filled out with default data that is overridable
        EstimateConvertToJob convert = getInvokeActionPortType().getEstimateConvertToJob( estimate );

        //Set some fields on the bean
        convert.setDescription( "test foo convert" );
        convert.setPoNumber( "test po" );

        convert.setPromiseDate( DatatypeFactory.newInstance().newXMLGregorianCalendar( gc ) );

        if( null == convert.getCustomer() )
        {
            convert.setCustomer( cust );
        }
        else
        {
            cust = convert.getCustomer();
        }

        convert.setJobType( type );
        convert.setConvertIntoJob( combo );
        convert.setCreateNewJob( false );
        convert.setUpdateJobInfo( true );

        //See what Parts are avail for convert
        final List<EstimateConvertToJobPart> estimateParts =
            convert.getEstimateConvertToJobParts().getEstimateConvertToJobPart();

        for( final EstimateConvertToJobPart part : estimateParts )
        {
            EstimateQuantity qty = new EstimateQuantity();

            qty.setId( part.getQuantityToConvert().getId() );

            qty = getReadObjectPortType().readEstimateQuantity( qty );

            part.setSelected( true );

            System.out.println( "Part " + ( qty.getId() ) + " is avail for convert" );
            System.out.println( "Part " + ( qty.getId() ) + " description =" + part.getDescription() );
            System.out
                .println( "Part " + ( qty.getId() ) + " quantity to convert quoted price =" + part
                    .getQuantityToConvert()
                    .getQuotedPrice() );
            System.out.println( "Part " + ( qty.getId() ) + " quantity =" + qty.getQuantityOrdered() );

            // We can also change the QuanityToConvert by selecting another Qty avail on this part

            //part.getQuanities();

            // We can also choose not to convert this part

            //part.setSelected( Boolean.FALSE );
        }

        final Job convertTo = getInvokeActionPortType().convertEstimateToJob( convert );

        System.out.println( "Converted Estimate " + estimate.getId() + " to Job " + convertTo.getJob() );
        System.out.println( "Job Po Number = " + convertTo.getPoNum() );
        System.out.println( "Job Description = " + convertTo.getDescription() );
    }

    public Job createJob( final ItemTemplate template, final List<JobPart> parts ) throws Exception
    {
        Job job = new Job();
        job.setDescription( "Created from template - " + template.getDescription() );
        job.setCustomer( m_customerCode );
        job.setItemTemplate( template.getCode() );
        job.setPart1QuantityOrdered( Integer.valueOf( m_quantityOrdered ) );
        job = getCreateObjectPortType().createJob( job );

        System.out.println( "Created job for '"
                                + job.getCustomer()
                                + "' on "
                                + job.getDateSetup() );

        System.out.println( "Job add addition complete for " + job.getJob() );

        JobPart part = getJobPart( "01", job );

        parts.add( part );

        return job;
    }

    public Job createJobMultipleParts( final ItemTemplate template, final List<JobPart> parts ) throws Exception
    {
        final Job job = createJob( template, parts );

        //now get the part 01 that was auto added
        JobPart part = new JobPart();
        part.setJob( job.getJob() );
        part.setJobPart( "01" );

        part = getReadObjectPortType().readJobPart( part );

        //now set fields on that part that already exists
        part.setQtyOrdered( Integer.valueOf( m_quantityOrdered ) );
        getUpdateObjectPortType().updateJobPart( part );

        //Now let's add Part 02 if you needed it
        JobPart part2 = new JobPart();
        part2.setJob( job.getJob() );
        part2.setItemTemplate( template.getCode() );

        //Never set this when adding a new part
        // part2.setJobPart( "01" );
        part2.setQtyOrdered( Integer.valueOf( m_quantityOrdered ) );
        part2 = getCreateObjectPortType().createJobPart( part2 );

        System.out.println( "Created 2nd job part for '"
                                + part2.getJob()
                                + "' Part # "
                                + part2.getJobPart() );

        parts.add( part2 );

        return job;
    }

    public ItemTemplate getOrCreateItemTemplate( final String code )
    {
        // here you could get an existing ItemTemplate or create a new one.  99% of the time you would get an existing one.

        final List<String> existingItemTemplateIds =
            getFindObjectsPortType().find( "ItemTemplate", "@code='" + code + "'" )
                .getString();

        ItemTemplate template = new ItemTemplate();
        template.setCode( code );

        if( 1 == existingItemTemplateIds.size() )
        {
            template.setPrimaryKey( code );

            template = getReadObjectPortType().readItemTemplate( template );

            System.out.println( "Successfully found an existing ItemTemplate for code=" + template.getCode() + "." );
        }
        else
        {
            template.setDescription( "Sample Template" );
            template.setItemTemplateType( "VAR" ); //seeded item template type
            template.setJobProductType( "DSFDEF" ); //seeded job product type
            template.setSalesCategory( 1 ); //seeded sales category
            template.setBaseObject( "JobPart" );
            template.setQtyOptions( 2 ); //N/A=0, 1=1, Multiple=2
            template = getCreateObjectPortType().createItemTemplate( template );

            ItemTemplateLine line1 = new ItemTemplateLine();
            line1.setItemTemplate( template.getCode() );
            line1.setDataObject( "JobPartPressForm" );
            line1 = getCreateObjectPortType().createItemTemplateLine( line1 );

            ItemTemplateLineAttribute line1Attr1 = new ItemTemplateLineAttribute();
            line1Attr1.setItemTemplateLine( line1.getId() );
            line1Attr1.setAttribute( "formNum" );
            line1Attr1.setExpressionType( 2 ); //xpath=1, static=2, external-xpath=3
            line1Attr1.setDefaultValue( "1" );
            line1Attr1 = getCreateObjectPortType().createItemTemplateLineAttribute( line1Attr1 );

            ItemTemplateLineAttribute line1Attr2 = new ItemTemplateLineAttribute();
            line1Attr2.setItemTemplateLine( line1.getId() );
            line1Attr2.setAttribute( "numUp" );
            line1Attr2.setExpressionType( 2 ); //xpath=1, static=2, external-xpath=3
            line1Attr2.setDefaultValue( "1" );
            line1Attr2 = getCreateObjectPortType().createItemTemplateLineAttribute( line1Attr2 );

            ItemTemplateLineAttribute line1Attr3 = new ItemTemplateLineAttribute();
            line1Attr3.setItemTemplateLine( line1.getId() );
            line1Attr3.setAttribute( "press" );
            line1Attr3.setExpressionType( 2 ); //xpath=1, static=2, external-xpath=3
            line1Attr3.setDefaultValue( "1" ); //seeded press
            line1Attr3 = getCreateObjectPortType().createItemTemplateLineAttribute( line1Attr3 );

            ItemTemplateLineAttribute line1Attr4 = new ItemTemplateLineAttribute();
            line1Attr4.setItemTemplateLine( line1.getId() );
            line1Attr4.setAttribute( "qtyToMfg" );
            line1Attr4.setExpressionType( 1 ); //xpath=1, static=2, external-xpath=3
            line1Attr4.setDefaultValue( "../@qtyToMfg" ); //seeded press
            line1Attr4 = getCreateObjectPortType().createItemTemplateLineAttribute( line1Attr4 );

            System.out.println( "Successfully created a new ItemTemplate for code=" + code + "." );
        }

        if( !template.isActive() )
        {
            template.setActive( true );
            getUpdateObjectPortType().updateItemTemplate( template );
        }
        return template;
    }
}