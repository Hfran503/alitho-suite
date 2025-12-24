package com.pace2020.epace.sdk.sample;

import java.util.ArrayList;
import java.util.List;

import com.pace2020.epace.object.ItemTemplate;
import com.pace2020.epace.object.Job;
import com.pace2020.epace.object.JobCost;
import com.pace2020.epace.object.JobPart;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/**
 * @author <a href="mailto:faizanr@efi.com">faizan raza</a>
 */
public class JobPlanRefreshSample extends SecuredWSDLClient
{
    public static void main( final String[] args ) throws Exception
    {
        new JobPlanRefreshSample().run( args );
    }

    public void run( final String[] args ) throws Exception
    {
        Job job;
        if( args.length == 0 )
        {
            final CreateTwoJobsUsingItemTemplatesAndCreateComboJobSample
                sample = new CreateTwoJobsUsingItemTemplatesAndCreateComboJobSample("HOUSE", "12345");
            final ItemTemplate template = sample.getOrCreateItemTemplate( "TMP" );

            final List<JobPart> parts = new ArrayList<>();

            job = sample.createJob( template, parts );
        }
        else
        {
            job = new Job();
            job.setJob( args[0] );
            job = getReadObjectPortType().readJob( job );
        }

        createSampleJobCosts( job.getJob(), "01" );

        findJobPlans( job.getJob(), "01" );
        getInvokeProcessHttpPort().refreshJobPlansForJob( job );
        System.out.println( "Job plans refreshed...." );
        getInvokeProcessHttpPort().updateLinksJobPlansForJob( job );
        System.out.println( "Links Updated...." );
        findJobPlans( job.getJob(), "01" );
    }

    public void createSampleJobCosts( final String jobId, final String partId )
    {
        JobCost jobCost = new JobCost();
        jobCost.setJob( jobId );
        jobCost.setJobPart( partId );

        jobCost.setActivityCode( "000" );
        jobCost.setChargeClass( 1 );

        jobCost = getCreateObjectPortType().createJobCost( jobCost );
    }

    public void findJobPlans( final String jobId, final String partId )
    {
        final List<String> jobPlanIds =
            getFindObjectsPortType().find( "JobPlan", "@job='" + jobId + "'" ).getString();

        System.out.println( jobPlanIds.size() + " job plans for job " + jobId );
    }
}